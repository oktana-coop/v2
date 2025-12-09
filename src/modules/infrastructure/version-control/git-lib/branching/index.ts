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

export type GetBranchCommitHistoryArgs = IsoGitDeps & {
  branch: Branch;
  limit?: number;
};

type SortBranchesByRecencyArgs = IsoGitDeps & {
  branches: Branch[];
};

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

export const getBranchCommitHistory = ({
  isoGitFs,
  dir,
  branch,
  limit,
}: GetBranchCommitHistoryArgs): Effect.Effect<
  Commit[],
  RepositoryError | NotFoundError,
  never
> =>
  pipe(
    Effect.tryPromise({
      try: () =>
        git.log({
          fs: isoGitFs,
          dir,
          ref: branch,
          depth: limit,
        }),
      catch: (err) => {
        if (err instanceof IsoGitErrors.NotFoundError) {
          return new NotFoundError('No commit found');
        }

        return new RepositoryError('Git repo error');
      },
    }),
    Effect.catchTag('VersionControlNotFoundError', () => Effect.succeed([])),
    Effect.map((gitLog) =>
      gitLog.map(
        (commitInfo) =>
          ({
            // TODO: Handle parsing errors
            id: parseGitCommitHash(commitInfo.oid),
            message: commitInfo.commit.message,
            time: new Date(commitInfo.commit.author.timestamp * 1000),
          }) as Commit
      )
    )
  );

const sortBranchesByRecency = ({
  isoGitFs,
  dir,
  branches,
}: SortBranchesByRecencyArgs): Effect.Effect<
  Branch[],
  RepositoryError | NotFoundError,
  never
> =>
  pipe(
    getCurrentBranch({ isoGitFs, dir }),
    Effect.flatMap((currentBranch) =>
      Effect.forEach(branches, (branch) =>
        pipe(
          getBranchCommitHistory({ isoGitFs, dir, branch, limit: 1 }),
          Effect.map((commits) => (commits.length > 0 ? commits[0] : null)),
          Effect.map((lastCommit) => ({
            branch,
            isCurrent: branch === currentBranch,
            lastCommit,
          }))
        )
      )
    ),
    Effect.map((branchesWithCommitInfo) =>
      branchesWithCommitInfo.sort((branch1, branch2) => {
        // Current branch comes first
        if (branch1.isCurrent !== branch2.isCurrent) {
          return Number(branch2.isCurrent) - Number(branch1.isCurrent);
        }

        // Branches with commits come before branches without
        const branch1HasCommit = branch1.lastCommit !== null;
        const branch2HasCommit = branch2.lastCommit !== null;
        if (branch1HasCommit !== branch2HasCommit) {
          return Number(branch2HasCommit) - Number(branch1HasCommit);
        }

        // Sort by most recent commit (newer first)
        if (branch1.lastCommit && branch2.lastCommit) {
          return (
            branch2.lastCommit.time.getTime() -
            branch1.lastCommit.time.getTime()
          );
        }

        return 0;
      })
    ),
    Effect.map((branchesWithCommitInfo) =>
      branchesWithCommitInfo.map(({ branch }) => branch)
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
    ),
    Effect.flatMap((branches) =>
      sortBranchesByRecency({ isoGitFs, dir, branches })
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
