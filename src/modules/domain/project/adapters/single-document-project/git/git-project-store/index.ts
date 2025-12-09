import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import git, { type PromiseFsClient as IsoGitFsApi } from 'isomorphic-git';

import {
  type Filesystem,
  FilesystemNotFoundErrorTag,
} from '../../../../../../../modules/infrastructure/filesystem';
import {
  createAndSwitchToBranch as createAndSwitchToBranchWithGit,
  createGitBlobRef,
  DEFAULT_BRANCH,
  deleteBranch as deleteBranchWithGit,
  getCurrentBranch as getCurrentBranchWithGit,
  listBranches as listBranchesWithGit,
  mergeAndDeleteBranch as mergeAndDeleteBranchWithGit,
  MigrationError,
  switchToBranch as switchToBranchWithGit,
  VersionControlNotFoundErrorTag,
  VersionControlRepositoryErrorTag,
} from '../../../../../../../modules/infrastructure/version-control';
import { mapErrorTo } from '../../../../../../../utils/errors';
import { projectTypes } from '../../../../constants';
import {
  NotFoundError,
  RepositoryError,
  ValidationError,
} from '../../../../errors';
import {
  type BaseArtifactMetaData,
  CURRENT_SINGLE_DOCUMENT_PROJECT_SCHEMA_VERSION,
  ProjectFsPath,
  type ProjectId,
} from '../../../../models';
import { type SingleDocumentProjectStore } from '../../../../ports';

export const createAdapter = ({
  isoGitFs,
  filesystem,
  projectFilePath,
  internalProjectDir,
  projectName,
  documentInternalPath,
}: {
  // We have 2 filesystem APIs because isomorphic-git works well in both browser in Node.js
  // with its own implemented fs APIs, which more or less comply to the Node.js API.
  // In cases where we interact with the filesystem outside isomorphic-git (e.g. for listing files or normailizing paths),
  // we are using our own Filesystem API.
  isoGitFs: IsoGitFsApi;
  filesystem: Filesystem;
  projectFilePath: ProjectFsPath;
  internalProjectDir: string;
  projectName: string;
  documentInternalPath: string;
}): SingleDocumentProjectStore => {
  const createSingleDocumentProject: SingleDocumentProjectStore['createSingleDocumentProject'] =
    () =>
      pipe(
        Effect.succeed(projectFilePath),
        Effect.tap(() =>
          Effect.tryPromise({
            try: () =>
              git.init({
                fs: isoGitFs,
                dir: internalProjectDir,
                defaultBranch: DEFAULT_BRANCH,
              }),
            catch: mapErrorTo(RepositoryError, 'Git repo error'),
          })
        )
      );

  const findProjectById: SingleDocumentProjectStore['findProjectById'] = (
    projectId
  ) =>
    pipe(
      getCurrentBranch({ projectId }),
      Effect.flatMap((currentBranch) =>
        Effect.try({
          try: () =>
            createGitBlobRef({
              ref: currentBranch,
              path: documentInternalPath,
            }),
          catch: mapErrorTo(
            ValidationError,
            'Cannot create the Git blob ref for the document'
          ),
        })
      ),
      // Ensure document path exists in the filesystem
      Effect.tap(() =>
        pipe(
          filesystem.readFile(documentInternalPath),
          Effect.catchTag(FilesystemNotFoundErrorTag, () =>
            Effect.fail(
              new NotFoundError(
                `File with path ${documentInternalPath} not found`
              )
            )
          ),
          Effect.catchAll(() =>
            Effect.fail(new RepositoryError('Git repo error'))
          )
        )
      ),
      Effect.map((documentId) => ({
        type: projectTypes.SINGLE_DOCUMENT_PROJECT,
        schemaVersion: CURRENT_SINGLE_DOCUMENT_PROJECT_SCHEMA_VERSION,
        document: {
          id: documentId,
        },
        name: projectName,
      }))
    );

  const getDocumentFromProject = (
    projectId: ProjectId
  ): Effect.Effect<
    BaseArtifactMetaData,
    ValidationError | NotFoundError | RepositoryError | MigrationError,
    never
  > =>
    pipe(
      findProjectById(projectId),
      Effect.map((project) => project.document)
    );

  const findDocumentInProject: SingleDocumentProjectStore['findDocumentInProject'] =
    (projectId) =>
      pipe(
        getDocumentFromProject(projectId),
        Effect.map((document) => document.id)
      );

  const getProjectName: SingleDocumentProjectStore['getProjectName'] = (id) =>
    pipe(
      findProjectById(id),
      Effect.map((project) => project.name)
    );

  const createAndSwitchToBranch: SingleDocumentProjectStore['createAndSwitchToBranch'] =
    ({ branch }) =>
      pipe(
        createAndSwitchToBranchWithGit({
          isoGitFs,
          dir: internalProjectDir,
          branch,
        }),
        Effect.catchTag(VersionControlRepositoryErrorTag, (err) =>
          Effect.fail(new RepositoryError(err.message))
        )
      );

  const switchToBranch: SingleDocumentProjectStore['switchToBranch'] = ({
    branch,
  }) =>
    pipe(
      switchToBranchWithGit({
        isoGitFs,
        dir: internalProjectDir,
        branch,
      }),
      Effect.catchTag(VersionControlRepositoryErrorTag, (err) =>
        Effect.fail(new RepositoryError(err.message))
      )
    );

  const getCurrentBranch: SingleDocumentProjectStore['getCurrentBranch'] = () =>
    pipe(
      getCurrentBranchWithGit({
        isoGitFs,
        dir: internalProjectDir,
      }),
      Effect.catchTag(VersionControlNotFoundErrorTag, (err) =>
        Effect.fail(new NotFoundError(err.message))
      ),
      Effect.catchTag(VersionControlRepositoryErrorTag, (err) =>
        Effect.fail(new RepositoryError(err.message))
      )
    );

  const listBranches: SingleDocumentProjectStore['listBranches'] = () =>
    pipe(
      listBranchesWithGit({
        isoGitFs,
        dir: internalProjectDir,
      }),
      Effect.catchTag(VersionControlNotFoundErrorTag, (err) =>
        Effect.fail(new NotFoundError(err.message))
      ),
      Effect.catchTag(VersionControlRepositoryErrorTag, (err) =>
        Effect.fail(new RepositoryError(err.message))
      )
    );

  const deleteBranch: SingleDocumentProjectStore['deleteBranch'] = ({
    branch,
  }) =>
    pipe(
      deleteBranchWithGit({
        isoGitFs,
        dir: internalProjectDir,
        branch,
      }),
      Effect.catchTag(VersionControlNotFoundErrorTag, (err) =>
        Effect.fail(new NotFoundError(err.message))
      ),
      Effect.catchTag(VersionControlRepositoryErrorTag, (err) =>
        Effect.fail(new RepositoryError(err.message))
      )
    );

  const mergeAndDeleteBranch: SingleDocumentProjectStore['mergeAndDeleteBranch'] =
    ({ from, into }) =>
      pipe(
        mergeAndDeleteBranchWithGit({
          isoGitFs,
          dir: internalProjectDir,
          from,
          into,
        }),
        Effect.catchTag(VersionControlNotFoundErrorTag, (err) =>
          Effect.fail(new NotFoundError(err.message))
        ),
        Effect.catchTag(VersionControlRepositoryErrorTag, (err) =>
          Effect.fail(new RepositoryError(err.message))
        )
      );

  // This is a no-op in the Git document repo.
  const disconnect: SingleDocumentProjectStore['disconnect'] = () =>
    Effect.succeed(undefined);

  return {
    createSingleDocumentProject,
    findProjectById,
    findDocumentInProject,
    getProjectName,
    createAndSwitchToBranch,
    switchToBranch,
    getCurrentBranch,
    listBranches,
    deleteBranch,
    mergeAndDeleteBranch,
    disconnect,
  };
};
