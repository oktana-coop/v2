import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import git, { Errors as IsoGitErrors } from 'isomorphic-git';

import { fromNullable } from '../../../../../utils/effect';
import { mapErrorTo } from '../../../../../utils/errors';
import { DEFAULT_AUTHOR_NAME } from '../../constants';
import {
  MergeConflictError,
  NotFoundError,
  RepositoryError,
} from '../../errors';
import {
  type Branch,
  type Commit,
  DEFAULT_BRANCH,
  GitCommitHash,
  type MergeConflictInfo,
  parseGitCommitHash,
} from '../../models';
import { deleteBranch, switchToBranch } from '../branching';
import { IsoGitDeps } from '../types';

export type MergeAndDeleteBranchArgs = Omit<IsoGitDeps, 'isoGitHttp'> & {
  from: Branch;
  into: Branch;
};

export const mergeAndDeleteBranch = ({
  isoGitFs,
  dir,
  from,
  into,
}: MergeAndDeleteBranchArgs): Effect.Effect<
  Commit['id'],
  RepositoryError | NotFoundError | MergeConflictError,
  never
> =>
  pipe(
    Effect.tryPromise({
      try: () =>
        git.merge({
          fs: isoGitFs,
          dir,
          ours: into,
          theirs: from,
          author: {
            name: DEFAULT_AUTHOR_NAME,
          },
        }),
      catch: (err) => {
        console.log(err);
        if (
          err instanceof IsoGitErrors.MergeNotSupportedError ||
          err instanceof IsoGitErrors.MergeConflictError
        ) {
          return new MergeConflictError(
            `Error when trying to merge ${from} into ${into} due to conflicts.`
          );
        }

        return new RepositoryError(
          `Error when trying to merge ${from} into ${into}`
        );
      },
    }),
    Effect.flatMap(({ oid }) =>
      pipe(
        fromNullable(
          oid,
          () =>
            // TODO: Revert the whole merge in this case (in a transactional manner).
            new RepositoryError(
              'Could not resolve the new head of the branch after merging.'
            )
        ),
        Effect.flatMap((mergeCommitId) =>
          Effect.try({
            try: () => parseGitCommitHash(mergeCommitId),
            catch: mapErrorTo(RepositoryError, 'Invalid merge commit ID.'),
          })
        )
      )
    ),
    Effect.tap(() => deleteBranch({ isoGitFs, dir, branch: from })),
    Effect.tap(() =>
      switchToBranch({ isoGitFs, dir, branch: DEFAULT_BRANCH as Branch })
    )
  );

export type IsInMergeConflictStateArgs = Omit<IsoGitDeps, 'isoGitHttp'>;

export const isInMergeConflictState = ({
  isoGitFs,
  dir,
}: IsInMergeConflictStateArgs): Effect.Effect<
  boolean,
  RepositoryError,
  never
> =>
  pipe(
    Effect.tryPromise({
      try: async () => {
        await git.resolveRef({
          fs: isoGitFs,
          dir,
          ref: 'MERGE_HEAD',
        });
        return true;
      },
      catch: mapErrorTo(NotFoundError, 'Merge head not found'),
    }),
    Effect.catchAll(() => Effect.succeed(false))
  );

export type GetMergeConflictInfoArgs = Omit<IsoGitDeps, 'isoGitHttp'>;

const getCommitForRef = ({
  ref,
  isoGitFs,
  dir,
}: Omit<IsoGitDeps, 'isoGitHttp'> & { ref: string }): Effect.Effect<
  GitCommitHash,
  RepositoryError,
  never
> =>
  pipe(
    Effect.tryPromise({
      try: () =>
        git.resolveRef({
          fs: isoGitFs,
          dir,
          ref,
        }),
      catch: mapErrorTo(RepositoryError, 'Error in resolving Git repo HEAD.'),
    }),
    Effect.flatMap((commitOid) =>
      Effect.try({
        try: () => parseGitCommitHash(commitOid),
        catch: mapErrorTo(
          RepositoryError,
          'Error in resolving Git repo HEAD commit id.'
        ),
      })
    )
  );

const getCommitsRelatedToMerge = ({
  isoGitFs,
  dir,
}: Omit<IsoGitDeps, 'isoGitHttp'>): Effect.Effect<
  {
    targetCommitId: Commit['id'];
    sourceCommitId: Commit['id'];
    commonAncestorCommitId: Commit['id'];
  },
  RepositoryError,
  never
> =>
  Effect.Do.pipe(
    Effect.bind('targetCommitId', () =>
      getCommitForRef({ ref: 'HEAD', isoGitFs, dir })
    ),
    Effect.bind('sourceCommitId', () =>
      getCommitForRef({ ref: 'MERGE_HEAD', isoGitFs, dir })
    ),
    Effect.bind(
      'commonAncestorCommitId',
      ({ targetCommitId, sourceCommitId }) =>
        pipe(
          Effect.tryPromise({
            try: async () => {
              const result = await git.findMergeBase({
                fs: isoGitFs,
                dir,
                oids: [targetCommitId, sourceCommitId],
              });

              // findMergeBase returns any[]; narrow it to string[].
              if (
                !Array.isArray(result) ||
                !result.every((x) => typeof x === 'string')
              ) {
                throw new Error('Unexpected return value from findMergeBase');
              }

              if (result.length === 0) {
                throw new Error(
                  'No merge base (common ancestor between source and target commit) found'
                );
              }

              console.warn(
                'Multiple merge bases (common ancestors between source and target commits) found, using first'
              );

              return result[0];
            },
            catch: mapErrorTo(
              RepositoryError,
              'Error in finding common ancestor between source and target commits.'
            ),
          }),
          Effect.flatMap((mergeBaseInput) =>
            Effect.try({
              try: () => parseGitCommitHash(mergeBaseInput),
              catch: mapErrorTo(
                RepositoryError,
                'Error in resolving Git repo HEAD commit id.'
              ),
            })
          )
        )
    )
  );

export const getMergeConflictInfo = ({
  isoGitFs,
  dir,
}: GetMergeConflictInfoArgs): Effect.Effect<
  MergeConflictInfo | null,
  RepositoryError,
  never
> =>
  pipe(
    isInMergeConflictState({ dir, isoGitFs }),
    Effect.flatMap((inMergeConflictState) =>
      inMergeConflictState
        ? pipe(
            getCommitsRelatedToMerge({ dir, isoGitFs }),
            Effect.tap(() =>
              Effect.tryPromise({
                try: async () => {
                  const indexFiles = await git.listFiles({ dir, fs: isoGitFs });
                  console.log(indexFiles);
                  return indexFiles;
                },
                catch: mapErrorTo(
                  RepositoryError,
                  'Error in listing Git index files.'
                ),
              })
            ),
            // TODO: Gather conflicts
            Effect.map((mergeCommitsInfo) => ({
              ...mergeCommitsInfo,
              conflicts: [],
            }))
          )
        : Effect.succeed(null)
    )
  );
