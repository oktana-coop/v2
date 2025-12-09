import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as Option from 'effect/Option';
import git, { type PromiseFsClient as IsoGitFsApi } from 'isomorphic-git';

import {
  type Filesystem,
  removePath,
} from '../../../../../../../modules/infrastructure/filesystem';
import {
  createAndSwitchToBranch as createAndSwitchToBranchWithGit,
  createGitBlobRef,
  DEFAULT_AUTHOR_NAME,
  DEFAULT_BRANCH,
  deleteBranch as deleteBranchWithGit,
  getCurrentBranch as getCurrentBranchWithGit,
  isGitBlobRef,
  listBranches as listBranchesWithGit,
  mergeAndDeleteBranch as mergeAndDeleteBranchWithGit,
  type ResolvedArtifactId,
  switchToBranch as switchToBranchWithGit,
  VersionControlNotFoundErrorTag,
  VersionControlRepositoryErrorTag,
  versionedArtifactTypes,
} from '../../../../../../../modules/infrastructure/version-control';
import { mapErrorTo } from '../../../../../../../utils/errors';
import {
  NotFoundError,
  RepositoryError,
  ValidationError,
} from '../../../../errors';
import {
  type ArtifactMetaData,
  CURRENT_MULTI_DOCUMENT_PROJECT_SCHEMA_VERSION,
  isProjectFsPath,
  parseProjectFsPath,
  type ProjectFsPath,
  type ProjectId,
} from '../../../../models';
import { MultiDocumentProjectStore } from '../../../../ports/multi-document-project';

export const createAdapter = ({
  isoGitFs,
  filesystem,
}: {
  // We have 2 filesystem APIs because isomorphic-git works well in both browser in Node.js
  // with its own implemented fs APIs, which more or less comply to the Node.js API.
  // In cases where we interact with the filesystem outside isomorphic-git (e.g. for listing files or normailizing paths),
  // we are using our own Filesystem API.
  isoGitFs: IsoGitFsApi;
  filesystem: Filesystem;
}): MultiDocumentProjectStore => {
  const ensureProjectIdIsFsPath: (
    projectId: ProjectId
  ) => Effect.Effect<ProjectFsPath, ValidationError, never> = (projectId) =>
    pipe(
      Effect.succeed(projectId),
      Effect.filterOrFail(
        isProjectFsPath,
        (val) => new ValidationError(`Invalid project id: ${val}`)
      )
    );

  const createProject: MultiDocumentProjectStore['createProject'] = ({
    path,
  }) =>
    pipe(
      Effect.try({
        try: () => parseProjectFsPath(path),
        catch: mapErrorTo(ValidationError, 'Invalid project path'),
      }),
      Effect.tap((projectPath) =>
        Effect.tryPromise({
          try: () =>
            git.init({
              fs: isoGitFs,
              dir: projectPath,
              defaultBranch: DEFAULT_BRANCH,
            }),
          catch: mapErrorTo(RepositoryError, 'Git repo error'),
        })
      )
    );

  const getDirectoryFiles = (id: ProjectId) =>
    pipe(
      ensureProjectIdIsFsPath(id),
      Effect.flatMap((projectPath) =>
        pipe(
          filesystem.listDirectoryFiles({
            path: projectPath,
            useRelativePath: true,
          }),
          Effect.catchAll(() =>
            Effect.fail(new RepositoryError('Git repo error'))
          )
        )
      )
    );

  const findProjectById: MultiDocumentProjectStore['findProjectById'] = (id) =>
    Effect.Do.pipe(
      Effect.bind('files', () => getDirectoryFiles(id)),
      Effect.bind('currentBranch', () => getCurrentBranch({ projectId: id })),
      Effect.map(({ files, currentBranch }) =>
        files.reduce<Record<ResolvedArtifactId, ArtifactMetaData>>(
          (acc, file) => {
            // TODO: Handle errors returned by createGitBlobRef
            const documentId = createGitBlobRef({
              ref: currentBranch,
              path: file.path,
            });

            acc[documentId] = {
              id: documentId,
              name: file.name,
              path: file.path,
            };

            return acc;
          },
          {}
        )
      ),
      Effect.map((documents) => ({
        type: versionedArtifactTypes.MULTI_DOCUMENT_PROJECT,
        schemaVersion: CURRENT_MULTI_DOCUMENT_PROJECT_SCHEMA_VERSION,
        path: id,
        documents,
      }))
    );

  const listProjectDocuments: MultiDocumentProjectStore['listProjectDocuments'] =
    (id) =>
      pipe(
        findProjectById(id),
        Effect.map((project) => Object.values(project.documents))
      );

  // This is a no-op in the Git repo.
  // The new doc will be committed when we commit the first set of changes to it.
  const addDocumentToProject: MultiDocumentProjectStore['addDocumentToProject'] =
    () => Effect.succeed(undefined);

  const deleteDocumentFromProject: MultiDocumentProjectStore['deleteDocumentFromProject'] =
    ({ projectId, documentId }) =>
      Effect.Do.pipe(
        Effect.bind('projectPath', () => ensureProjectIdIsFsPath(projectId)),
        Effect.bind('documentName', () =>
          pipe(
            Effect.succeed(documentId),
            Effect.filterOrFail(
              isGitBlobRef,
              (val) => new ValidationError(`Invalid document id: ${val}`)
            ),
            // TODO: This won't work well for documents inside sub-folders.
            Effect.map((documentGitBlobRef) => removePath(documentGitBlobRef))
          )
        ),
        Effect.flatMap(({ projectPath, documentName }) =>
          pipe(
            Effect.tryPromise({
              try: () =>
                git.remove({
                  fs: isoGitFs,
                  dir: projectPath,
                  filepath: documentName,
                }),
              catch: mapErrorTo(RepositoryError, 'Git repo error'),
            }),
            Effect.flatMap(() =>
              Effect.tryPromise({
                try: () =>
                  git.commit({
                    fs: isoGitFs,
                    dir: projectPath,
                    author: {
                      name: DEFAULT_AUTHOR_NAME,
                    },
                    message: `Removed ${documentName}`,
                  }),
                catch: mapErrorTo(RepositoryError, 'Git repo error'),
              })
            )
          )
        )
      );

  const findDocumentInProject: MultiDocumentProjectStore['findDocumentInProject'] =
    ({ projectId, documentPath }) =>
      pipe(
        listProjectDocuments(projectId),
        Effect.flatMap((projectDocuments) =>
          pipe(
            Option.fromNullable(
              projectDocuments.find(
                (documentMetaData) => documentMetaData.path === documentPath
              )
            ),
            Option.match({
              onNone: () =>
                Effect.fail(
                  new NotFoundError(
                    `Document with path ${documentPath} not found in project`
                  )
                ),
              onSome: (documentMetaData) => Effect.succeed(documentMetaData.id),
            })
          )
        )
      );

  const createAndSwitchToBranch: MultiDocumentProjectStore['createAndSwitchToBranch'] =
    ({ projectId, branch }) =>
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

  const switchToBranch: MultiDocumentProjectStore['switchToBranch'] = ({
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

  const getCurrentBranch: MultiDocumentProjectStore['getCurrentBranch'] = ({
    projectId,
  }) =>
    pipe(
      ensureProjectIdIsFsPath(projectId),
      Effect.flatMap((projectPath) =>
        pipe(
          getCurrentBranchWithGit({
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

  const listBranches: MultiDocumentProjectStore['listBranches'] = ({
    projectId,
  }) =>
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

  const deleteBranch: MultiDocumentProjectStore['deleteBranch'] = ({
    projectId,
    branch,
  }) =>
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

  const mergeAndDeleteBranch: MultiDocumentProjectStore['mergeAndDeleteBranch'] =
    ({ projectId, from, into }) =>
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
    supportsBranching: true,
    createProject,
    findProjectById,
    listProjectDocuments,
    addDocumentToProject,
    deleteDocumentFromProject,
    findDocumentInProject,
    createAndSwitchToBranch,
    switchToBranch,
    getCurrentBranch,
    listBranches,
    deleteBranch,
    mergeAndDeleteBranch,
  };
};
