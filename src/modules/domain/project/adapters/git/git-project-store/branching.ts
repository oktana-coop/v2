import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import { type PromiseFsClient as IsoGitFsApi } from 'isomorphic-git';

import {
  type Branch,
  createAndSwitchToBranch as createAndSwitchToBranchWithGit,
  deleteBranch as deleteBranchWithGit,
  getCurrentBranch as getCurrentBranchWithGit,
  listBranches as listBranchesWithGit,
  mergeAndDeleteBranch as mergeAndDeleteBranchWithGit,
  switchToBranch as switchToBranchWithGit,
  VersionControlNotFoundErrorTag,
  VersionControlRepositoryErrorTag,
} from '../../../../../../modules/infrastructure/version-control';
import { NotFoundError, RepositoryError } from '../../../errors';
import { type ProjectFsPath } from '../../../models';
import { type ProjectStore } from '../../../ports';
import { ensureProjectIdIsFsPath } from './project-id';

export const getCurrentBranch = ({
  isoGitFs,
  projectDir,
}: {
  isoGitFs: IsoGitFsApi;
  projectDir: ProjectFsPath;
}): Effect.Effect<Branch, NotFoundError | RepositoryError, never> =>
  pipe(
    getCurrentBranchWithGit({ isoGitFs, dir: projectDir }),
    Effect.catchTag(VersionControlNotFoundErrorTag, (err) =>
      Effect.fail(new NotFoundError(err.message))
    ),
    Effect.catchTag(VersionControlRepositoryErrorTag, (err) =>
      Effect.fail(new RepositoryError(err.message))
    )
  );

type BranchingOps = Pick<
  ProjectStore,
  | 'createAndSwitchToBranch'
  | 'switchToBranch'
  | 'getCurrentBranch'
  | 'listBranches'
  | 'deleteBranch'
  | 'mergeAndDeleteBranch'
>;

export const createBranchingOps = ({
  isoGitFs,
}: {
  isoGitFs: IsoGitFsApi;
}): BranchingOps => {
  const createAndSwitchToBranch: BranchingOps['createAndSwitchToBranch'] = ({
    projectId,
    branch,
  }) =>
    pipe(
      ensureProjectIdIsFsPath(projectId),
      Effect.flatMap((projectPath) =>
        pipe(
          createAndSwitchToBranchWithGit({
            isoGitFs,
            dir: projectPath,
            branch,
          }),
          Effect.catchTag(VersionControlRepositoryErrorTag, (err) =>
            Effect.fail(new RepositoryError(err.message))
          )
        )
      )
    );

  const switchToBranch: BranchingOps['switchToBranch'] = ({
    projectId,
    branch,
  }) =>
    pipe(
      ensureProjectIdIsFsPath(projectId),
      Effect.flatMap((projectPath) =>
        pipe(
          switchToBranchWithGit({
            isoGitFs,
            dir: projectPath,
            branch,
          }),
          Effect.catchTag(VersionControlRepositoryErrorTag, (err) =>
            Effect.fail(new RepositoryError(err.message))
          )
        )
      )
    );

  const getCurrentBranchOp: BranchingOps['getCurrentBranch'] = ({
    projectId,
  }) =>
    pipe(
      ensureProjectIdIsFsPath(projectId),
      Effect.flatMap((projectPath) =>
        getCurrentBranch({ isoGitFs, projectDir: projectPath })
      )
    );

  const listBranches: BranchingOps['listBranches'] = ({ projectId }) =>
    pipe(
      ensureProjectIdIsFsPath(projectId),
      Effect.flatMap((projectPath) =>
        pipe(
          listBranchesWithGit({
            isoGitFs,
            dir: projectPath,
          }),
          Effect.catchTag(VersionControlNotFoundErrorTag, (err) =>
            Effect.fail(new NotFoundError(err.message))
          ),
          Effect.catchTag(VersionControlRepositoryErrorTag, (err) =>
            Effect.fail(new RepositoryError(err.message))
          )
        )
      )
    );

  const deleteBranch: BranchingOps['deleteBranch'] = ({ projectId, branch }) =>
    pipe(
      ensureProjectIdIsFsPath(projectId),
      Effect.flatMap((projectPath) =>
        pipe(
          deleteBranchWithGit({
            isoGitFs,
            dir: projectPath,
            branch,
          }),
          Effect.catchTag(VersionControlNotFoundErrorTag, (err) =>
            Effect.fail(new NotFoundError(err.message))
          ),
          Effect.catchTag(VersionControlRepositoryErrorTag, (err) =>
            Effect.fail(new RepositoryError(err.message))
          )
        )
      )
    );

  const mergeAndDeleteBranch: BranchingOps['mergeAndDeleteBranch'] = ({
    projectId,
    from,
    into,
  }) =>
    pipe(
      ensureProjectIdIsFsPath(projectId),
      Effect.flatMap((projectPath) =>
        pipe(
          mergeAndDeleteBranchWithGit({
            isoGitFs,
            dir: projectPath,
            from,
            into,
          }),
          Effect.catchTag(VersionControlNotFoundErrorTag, (err) =>
            Effect.fail(new NotFoundError(err.message))
          ),
          Effect.catchTag(VersionControlRepositoryErrorTag, (err) =>
            Effect.fail(new RepositoryError(err.message))
          )
        )
      )
    );

  return {
    createAndSwitchToBranch,
    switchToBranch,
    getCurrentBranch: getCurrentBranchOp,
    listBranches,
    deleteBranch,
    mergeAndDeleteBranch,
  };
};
