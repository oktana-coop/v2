import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import git, {
  Errors as IsoGitErrors,
  type PromiseFsClient as IsoGitFsApi,
} from 'isomorphic-git';

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
  parseBranch,
  parseGitCommitHash,
} from '../../models';

type IsoGitDeps = {
  isoGitFs: IsoGitFsApi;
  dir: string;
};

export type CreateAndSwitchToBranchArgs = IsoGitDeps & {
  branch: Branch;
};

export type SwitchToBranchArgs = IsoGitDeps & {
  branch: Branch;
};

export type GetCurrentBranchArgs = IsoGitDeps;

export type ListBranchesArgs = IsoGitDeps;

export type DeleteBranchArgs = IsoGitDeps & {
  branch: Branch;
};

export type DeleteBranchResult = {
  currentBranch: Branch;
};

export type MergeAndDeleteBranchArgs = IsoGitDeps & {
  from: Branch;
  into: Branch;
};

export const createAndSwitchToBranch = ({
  isoGitFs,
  dir,
  branch,
}: CreateAndSwitchToBranchArgs): Effect.Effect<void, RepositoryError, never> =>
  Effect.tryPromise({
    try: () =>
      git.branch({
        fs: isoGitFs,
        dir,
        ref: branch,
        checkout: true,
      }),
    catch: mapErrorTo(RepositoryError, 'Git repo error'),
  });

export const switchToBranch = ({
  isoGitFs,
  dir,
  branch,
}: SwitchToBranchArgs): Effect.Effect<void, RepositoryError, never> =>
  Effect.tryPromise({
    try: () =>
      git.checkout({
        fs: isoGitFs,
        dir,
        ref: branch,
      }),
    catch: mapErrorTo(RepositoryError, 'Git repo error'),
  });

export const getCurrentBranch = ({
  isoGitFs,
  dir,
}: GetCurrentBranchArgs): Effect.Effect<
  Branch,
  RepositoryError | NotFoundError,
  never
> =>
  pipe(
    Effect.tryPromise({
      try: () =>
        git.currentBranch({
          fs: isoGitFs,
          dir,
        }),
      catch: mapErrorTo(RepositoryError, 'Error in getting the current branch'),
    }),
    Effect.filterOrFail(
      (currentBranch) => typeof currentBranch === 'string',
      () =>
        new NotFoundError(
          'Could not retrieve the current branch. The repo is in detached HEAD state.'
        )
    ),
    Effect.flatMap((currentBranch) =>
      Effect.try({
        try: () => parseBranch(currentBranch),
        catch: mapErrorTo(RepositoryError, 'Could not parse current branch'),
      })
    )
  );

export const listBranches = ({
  isoGitFs,
  dir,
}: ListBranchesArgs): Effect.Effect<
  Branch[],
  RepositoryError | NotFoundError,
  never
> =>
  pipe(
    Effect.tryPromise({
      try: () =>
        git.listBranches({
          fs: isoGitFs,
          dir,
        }),
      catch: mapErrorTo(RepositoryError, 'Error when listing branches'),
    }),
    Effect.flatMap((branches) =>
      Effect.forEach(branches, (branch) =>
        Effect.try({
          try: () => parseBranch(branch),
          catch: mapErrorTo(
            RepositoryError,
            `Could not parse branch ${branch}`
          ),
        })
      )
    )
  );

export const deleteBranch = ({
  isoGitFs,
  dir,
  branch,
}: DeleteBranchArgs): Effect.Effect<
  DeleteBranchResult,
  RepositoryError | NotFoundError,
  never
> =>
  Effect.Do.pipe(
    Effect.bind('currentBranch', () => getCurrentBranch({ isoGitFs, dir })),
    Effect.bind('resultBranch', ({ currentBranch }) =>
      currentBranch === branch
        ? pipe(
            Effect.succeed(DEFAULT_BRANCH as Branch),
            Effect.tap((newBranch) =>
              switchToBranch({
                isoGitFs,
                dir,
                branch: newBranch,
              })
            )
          )
        : Effect.succeed(currentBranch)
    ),
    Effect.flatMap(
      ({ currentBranch: preDeletionCurrentBranch, resultBranch }) =>
        pipe(
          Effect.tryPromise({
            try: () =>
              git.deleteBranch({
                fs: isoGitFs,
                dir,
                ref: branch,
              }),
            catch: mapErrorTo(
              RepositoryError,
              `Error in deleting ${branch} branch.`
            ),
          }),
          // If there was any error in deleting the branch,
          // we also switch back to the original current branch before returning the error.
          Effect.tapError((err) =>
            pipe(
              switchToBranch({
                isoGitFs,
                dir,
                branch: preDeletionCurrentBranch,
              }),
              Effect.flatMap(() => Effect.fail(err))
            )
          ),
          // On success, return the resulting branch as the current one.
          Effect.flatMap(() =>
            Effect.succeed({
              currentBranch: resultBranch,
            })
          )
        )
    )
  );

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
        if (err instanceof IsoGitErrors.MergeNotSupportedError) {
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
