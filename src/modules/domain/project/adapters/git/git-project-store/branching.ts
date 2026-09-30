import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import { type PromiseFsClient as IsoGitFsApi } from 'isomorphic-git';

import {
  type ArtifactId,
  type Branch,
  createAndSwitchToBranch as createAndSwitchToBranchWithGit,
  type DecomposedGitRef,
  deleteBranch as deleteBranchWithGit,
  getCurrentBranch as getCurrentBranchWithGit,
  isRefCheckedOut,
  listBranches as listBranchesWithGit,
  mergeAndDeleteBranch as mergeAndDeleteBranchWithGit,
  switchToBranch as switchToBranchWithGit,
  VersionControlNotFoundErrorTag,
  VersionControlRepositoryErrorTag,
} from '../../../../../../modules/infrastructure/version-control';
import { type Mutex } from '../../../../../../utils/effect';
import {
  DocumentNotOnCurrentRefError,
  NotFoundError,
  RepositoryError,
  ValidationError,
  VersionedProjectNotFoundErrorTag,
} from '../../../errors';
import { type ProjectFsPath, type ProjectId } from '../../../models';
import { type ProjectStore } from '../../../ports';
import { decomposeArtifactId } from './artifacts';
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

// The current branch, or null when HEAD is detached.
export const getCurrentBranchIfAny = ({
  isoGitFs,
  projectDir,
}: {
  isoGitFs: IsoGitFsApi;
  projectDir: ProjectFsPath;
}): Effect.Effect<Branch | null, RepositoryError, never> =>
  pipe(
    getCurrentBranch({ isoGitFs, projectDir }),
    Effect.map((branch): Branch | null => branch),
    Effect.catchTag(VersionedProjectNotFoundErrorTag, () =>
      Effect.succeed(null)
    )
  );

const describeGitRef = ({ ref, refType }: DecomposedGitRef): string =>
  refType === 'commit'
    ? `commit "${ref}"`
    : // The app does not handle tags yet, so a ref that is not a commit is a branch.
      // TODO: Handle tags.
      `branch "${ref}"`;

type DocumentRefArgs = {
  isoGitFs: IsoGitFsApi;
  projectId: ProjectId;
  documentId: ArtifactId;
};

export const ensureDocumentRefIsCheckedOut = ({
  isoGitFs,
  projectId,
  documentId,
}: DocumentRefArgs): Effect.Effect<
  void,
  ValidationError | RepositoryError | DocumentNotOnCurrentRefError,
  never
> =>
  Effect.Do.pipe(
    Effect.bind('projectDir', () => ensureProjectIdIsFsPath(projectId)),
    Effect.bind('documentRef', () => decomposeArtifactId(documentId)),
    Effect.bind('checkedOut', ({ projectDir, documentRef: { ref, refType } }) =>
      pipe(
        isRefCheckedOut({ isoGitFs, dir: projectDir, ref, refType }),
        Effect.catchTag(VersionControlRepositoryErrorTag, (err) =>
          Effect.fail(new RepositoryError(err.message))
        )
      )
    ),
    Effect.flatMap(({ projectDir, documentRef, checkedOut }) =>
      checkedOut
        ? Effect.void
        : pipe(
            getCurrentBranchIfAny({ isoGitFs, projectDir }),
            Effect.flatMap((currentBranch) =>
              Effect.fail(
                new DocumentNotOnCurrentRefError(
                  `The document belongs to ${describeGitRef(documentRef)}, which is not checked out.`,
                  { currentBranch }
                )
              )
            )
          )
    )
  );

// Checked before and after, since a checkout made outside the app can move
// HEAD meanwhile. Both checks read HEAD, which git writes last, so a checkout
// that has rewritten the files but not yet HEAD passes them.
//
// TODO: Close that gap by holding git's own lock (`.git/index.lock`).
export const whileDocumentRefIsCheckedOut =
  (args: DocumentRefArgs) =>
  <A, E, R>(
    effect: Effect.Effect<A, E, R>
  ): Effect.Effect<
    A,
    E | ValidationError | RepositoryError | DocumentNotOnCurrentRefError,
    R
  > =>
    pipe(
      ensureDocumentRefIsCheckedOut(args),
      Effect.zipRight(effect),
      Effect.tap(() => ensureDocumentRefIsCheckedOut(args))
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
  currentBranchMutex,
}: {
  isoGitFs: IsoGitFsApi;
  currentBranchMutex: Mutex;
}): BranchingOps => {
  const createAndSwitchToBranch: BranchingOps['createAndSwitchToBranch'] = ({
    projectId,
    branch,
  }) =>
    currentBranchMutex(
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
      )
    );

  const switchToBranch: BranchingOps['switchToBranch'] = ({
    projectId,
    branch,
  }) =>
    currentBranchMutex(
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
    currentBranchMutex(
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
      )
    );

  const mergeAndDeleteBranch: BranchingOps['mergeAndDeleteBranch'] = ({
    projectId,
    from,
    into,
  }) =>
    currentBranchMutex(
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
