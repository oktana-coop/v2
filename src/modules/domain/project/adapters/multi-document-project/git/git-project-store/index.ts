import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as Option from 'effect/Option';
import git, {
  type HttpClient as IsoGitHttpApi,
  type PromiseFsClient as IsoGitFsApi,
} from 'isomorphic-git';

import { type Filesystem } from '../../../../../../../modules/infrastructure/filesystem';
import {
  abortMerge as abortGitMerge,
  cloneRepository as cloneGitRepo,
  commitMergeConflictsResolution as commitMergeConflictsResolutionToGit,
  createAndSwitchToBranch as createAndSwitchToBranchWithGit,
  createGitBlobRef,
  decomposeGitBlobRef,
  DEFAULT_AUTHOR_NAME,
  DEFAULT_BRANCH,
  deleteBranch as deleteBranchWithGit,
  findRemoteByName as findGitRemoteByName,
  getCurrentBranch as getCurrentBranchWithGit,
  getMergeConflictInfo as getGitRepoMergeConflictInfo,
  getRemoteBranchInfo as getRemoteBranchInfoWithGit,
  getUserInfo as getUserInfoFromConfig,
  type GitBlobRef,
  isGitBlobRef,
  listBranches as listBranchesWithGit,
  listRemotes as listGitRemotes,
  mergeAndDeleteBranch as mergeAndDeleteBranchWithGit,
  pullFromRemote as pullFromRemoteGitRepo,
  pushToRemote as pushToRemoteGitRepo,
  removeFile as removeFileFromGit,
  type ResolvedArtifactId,
  setUserInfo as setUserInfoInGit,
  stageAndCommitWorkdirChanges,
  stageFile as stageFileInGit,
  switchToBranch as switchToBranchWithGit,
  validateAndAddRemote,
  VersionControlNotFoundErrorTag,
  VersionControlRepositoryErrorTag,
  versionedArtifactTypes,
  writeGitignore,
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
  isoGitHttp,
}: {
  // We have 2 filesystem APIs because isomorphic-git works well in both browser in Node.js
  // with its own implemented fs APIs, which more or less comply to the Node.js API.
  // In cases where we interact with the filesystem outside isomorphic-git (e.g. for listing files or normailizing paths),
  // we are using our own Filesystem API.
  isoGitFs: IsoGitFsApi;
  filesystem: Filesystem;
  isoGitHttp: IsoGitHttpApi;
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
    cloneUrl,
    authToken: authTokenInput,
    username,
    email,
  }) =>
    pipe(
      Effect.try({
        try: () => parseProjectFsPath(path),
        catch: mapErrorTo(ValidationError, 'Invalid project path'),
      }),
      Effect.tap((projectPath) =>
        cloneUrl
          ? pipe(
              ensureAuthTokenIsProvided(authTokenInput),
              Effect.flatMap((authToken) =>
                pipe(
                  cloneGitRepo({
                    isoGitFs,
                    isoGitHttp,
                    dir: projectPath,
                    url: cloneUrl,
                    authToken,
                  }),
                  Effect.catchTag(VersionControlRepositoryErrorTag, (err) =>
                    Effect.fail(new RepositoryError(err.message))
                  )
                )
              )
            )
          : pipe(
              Effect.tryPromise({
                try: () =>
                  git.init({
                    fs: isoGitFs,
                    dir: projectPath,
                    defaultBranch: DEFAULT_BRANCH,
                  }),
                catch: mapErrorTo(RepositoryError, 'Git repo error'),
              }),
              Effect.tap(() =>
                pipe(
                  writeGitignore({ isoGitFs, dir: projectPath }),
                  Effect.catchTag(VersionControlRepositoryErrorTag, (err) =>
                    Effect.fail(new RepositoryError(err.message))
                  )
                )
              )
            )
      ),
      Effect.tap((projectPath) =>
        setAuthorInfo({ projectId: projectPath, username, email })
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
            recursive: false,
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

  const ensureDocumentIdIsGitRef: (
    id: ResolvedArtifactId
  ) => Effect.Effect<GitBlobRef, ValidationError, never> = (id) =>
    pipe(
      Effect.succeed(id),
      Effect.filterOrFail(
        isGitBlobRef,
        (val) => new ValidationError(`Invalid document id: ${val}`)
      )
    );

  const extractDocumentRelativePathFromId: (
    id: ResolvedArtifactId
  ) => Effect.Effect<string, ValidationError, never> = (id) =>
    pipe(
      ensureDocumentIdIsGitRef(id),
      Effect.map((gitBlobRef) => {
        const { path: documentPath } = decomposeGitBlobRef(gitBlobRef);
        return documentPath;
      })
    );

  const deleteDocumentFromProject: MultiDocumentProjectStore['deleteDocumentFromProject'] =
    ({ projectId, documentId }) =>
      Effect.Do.pipe(
        Effect.bind('projectPath', () => ensureProjectIdIsFsPath(projectId)),
        Effect.bind('documentPath', () =>
          extractDocumentRelativePathFromId(documentId)
        ),
        Effect.bind('repoUserInfo', ({ projectPath }) =>
          pipe(
            getUserInfoFromConfig({ isoGitFs, dir: projectPath }),
            Effect.catchTag(VersionControlRepositoryErrorTag, (err) =>
              Effect.fail(new RepositoryError(err.message))
            )
          )
        ),
        Effect.flatMap(({ projectPath, documentPath, repoUserInfo }) =>
          pipe(
            pipe(
              removeFileFromGit({
                isoGitFs,
                dir: projectPath,
                path: documentPath,
              }),
              Effect.catchTag(VersionControlRepositoryErrorTag, (err) =>
                Effect.fail(new RepositoryError(err.message))
              )
            ),
            Effect.flatMap(() =>
              Effect.tryPromise({
                try: () =>
                  git.commit({
                    fs: isoGitFs,
                    dir: projectPath,
                    author: {
                      name: repoUserInfo.username ?? DEFAULT_AUTHOR_NAME,
                      email: repoUserInfo.email ?? undefined,
                    },
                    message: `Removed ${documentPath}`,
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

  const commitChanges: MultiDocumentProjectStore['commitChanges'] = ({
    projectId,
    message,
  }) =>
    pipe(
      ensureProjectIdIsFsPath(projectId),
      Effect.flatMap((projectPath) =>
        pipe(
          stageAndCommitWorkdirChanges({
            isoGitFs,
            dir: projectPath,
            message,
          }),
          Effect.catchTag(VersionControlRepositoryErrorTag, (err) =>
            Effect.fail(new RepositoryError(err.message))
          )
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

  const getMergeConflictInfo: MultiDocumentProjectStore['getMergeConflictInfo'] =
    ({ projectId }) =>
      pipe(
        ensureProjectIdIsFsPath(projectId),
        Effect.flatMap((projectPath) =>
          pipe(
            getGitRepoMergeConflictInfo({
              isoGitFs,
              dir: projectPath,
            }),
            Effect.catchTag(VersionControlRepositoryErrorTag, (err) =>
              Effect.fail(new RepositoryError(err.message))
            )
          )
        )
      );

  const abortMerge: MultiDocumentProjectStore['abortMerge'] = ({ projectId }) =>
    pipe(
      ensureProjectIdIsFsPath(projectId),
      Effect.flatMap((projectPath) =>
        pipe(
          abortGitMerge({
            isoGitFs,
            dir: projectPath,
          }),
          Effect.catchTag(VersionControlRepositoryErrorTag, (err) =>
            Effect.fail(new RepositoryError(err.message))
          )
        )
      )
    );

  const resolveConflictByKeepingDocument: MultiDocumentProjectStore['resolveConflictByKeepingDocument'] =
    ({ projectId, documentId }) =>
      Effect.Do.pipe(
        Effect.bind('projectPath', () => ensureProjectIdIsFsPath(projectId)),
        Effect.bind('documentPath', () =>
          extractDocumentRelativePathFromId(documentId)
        ),
        Effect.flatMap(({ projectPath, documentPath }) =>
          pipe(
            stageFileInGit({
              isoGitFs,
              dir: projectPath,
              path: documentPath,
            }),
            Effect.catchTag(VersionControlRepositoryErrorTag, (err) =>
              Effect.fail(new RepositoryError(err.message))
            )
          )
        )
      );

  const resolveConflictByDeletingDocument: MultiDocumentProjectStore['resolveConflictByDeletingDocument'] =
    ({ projectId, documentId }) =>
      Effect.Do.pipe(
        Effect.bind('projectPath', () => ensureProjectIdIsFsPath(projectId)),
        Effect.bind('documentPath', () =>
          extractDocumentRelativePathFromId(documentId)
        ),
        Effect.flatMap(({ projectPath, documentPath }) =>
          pipe(
            removeFileFromGit({
              isoGitFs,
              dir: projectPath,
              path: documentPath,
            }),
            Effect.catchTag(VersionControlRepositoryErrorTag, (err) =>
              Effect.fail(new RepositoryError(err.message))
            )
          )
        )
      );

  const commitMergeConflictsResolution: MultiDocumentProjectStore['commitMergeConflictsResolution'] =
    ({ projectId, message }) =>
      pipe(
        ensureProjectIdIsFsPath(projectId),
        Effect.flatMap((projectPath) =>
          pipe(
            commitMergeConflictsResolutionToGit({
              isoGitFs,
              dir: projectPath,
              message,
            }),
            Effect.catchTag(VersionControlRepositoryErrorTag, (err) =>
              Effect.fail(new RepositoryError(err.message))
            )
          )
        )
      );

  const setAuthorInfo: MultiDocumentProjectStore['setAuthorInfo'] = ({
    projectId,
    username,
    email,
  }) =>
    pipe(
      ensureProjectIdIsFsPath(projectId),
      Effect.flatMap((projectPath) =>
        pipe(
          setUserInfoInGit({
            isoGitFs,
            dir: projectPath,
            username,
            email,
          }),
          Effect.catchTag(VersionControlRepositoryErrorTag, (err) =>
            Effect.fail(new RepositoryError(err.message))
          )
        )
      )
    );

  const ensureAuthTokenIsProvided: (
    authToken: string | undefined
  ) => Effect.Effect<string, ValidationError, never> = (authToken) =>
    pipe(
      Option.fromNullable(authToken),
      Option.match({
        onNone: () =>
          Effect.fail(
            new ValidationError(
              'Auth token must be provided to perform this operation'
            )
          ),
        onSome: (token) => Effect.succeed(token),
      })
    );

  const addRemoteProject: MultiDocumentProjectStore['addRemoteProject'] = ({
    projectId,
    remoteName = 'origin',
    remoteUrl,
    authToken: authTokenInput,
  }) =>
    Effect.Do.pipe(
      Effect.bind('authToken', () => ensureAuthTokenIsProvided(authTokenInput)),
      Effect.bind('projectPath', () => ensureProjectIdIsFsPath(projectId)),
      Effect.flatMap(({ authToken, projectPath }) =>
        pipe(
          validateAndAddRemote({
            isoGitFs,
            isoGitHttp,
            dir: projectPath,
            name: remoteName,
            url: remoteUrl,
            authToken,
          }),
          Effect.catchTag(VersionControlRepositoryErrorTag, (err) =>
            Effect.fail(new RepositoryError(err.message))
          )
        )
      )
    );

  const listRemoteProjects: MultiDocumentProjectStore['listRemoteProjects'] = ({
    projectId,
  }) =>
    pipe(
      ensureProjectIdIsFsPath(projectId),
      Effect.flatMap((projectPath) =>
        pipe(
          listGitRemotes({
            isoGitFs,
            dir: projectPath,
          }),
          Effect.catchTag(VersionControlRepositoryErrorTag, (err) =>
            Effect.fail(new RepositoryError(err.message))
          ),
          Effect.flatMap((remotes) =>
            Effect.succeed(
              remotes.map((remote) => ({
                name: remote.remote,
                url: remote.url,
              }))
            )
          )
        )
      )
    );

  const findRemoteProjectByName: MultiDocumentProjectStore['findRemoteProjectByName'] =
    ({ projectId, remoteName = 'origin' }) =>
      pipe(
        ensureProjectIdIsFsPath(projectId),
        Effect.flatMap((projectPath) =>
          pipe(
            findGitRemoteByName({
              isoGitFs,
              dir: projectPath,
              name: remoteName,
            }),
            Effect.catchTag(VersionControlRepositoryErrorTag, (err) =>
              Effect.fail(new RepositoryError(err.message))
            ),
            Effect.catchTag(VersionControlNotFoundErrorTag, (err) =>
              Effect.fail(new NotFoundError(err.message))
            ),
            Effect.map((remoteInfo) => ({
              name: remoteInfo.remote,
              url: remoteInfo.url,
            }))
          )
        )
      );

  const pushToRemoteProject: MultiDocumentProjectStore['pushToRemoteProject'] =
    ({ projectId, remoteName = 'origin', authToken: authTokenInput }) =>
      Effect.Do.pipe(
        Effect.bind('authToken', () =>
          ensureAuthTokenIsProvided(authTokenInput)
        ),
        Effect.bind('projectPath', () => ensureProjectIdIsFsPath(projectId)),
        Effect.flatMap(({ authToken, projectPath }) =>
          pipe(
            pushToRemoteGitRepo({
              isoGitFs,
              isoGitHttp,
              dir: projectPath,
              remote: remoteName,
              authToken,
            }),
            Effect.catchTag(VersionControlRepositoryErrorTag, (err) =>
              Effect.fail(new RepositoryError(err.message))
            )
          )
        )
      );

  const pullFromRemoteProject: MultiDocumentProjectStore['pullFromRemoteProject'] =
    ({ projectId, remoteName = 'origin', authToken: authTokenInput }) =>
      Effect.Do.pipe(
        Effect.bind('authToken', () =>
          ensureAuthTokenIsProvided(authTokenInput)
        ),
        Effect.bind('projectPath', () => ensureProjectIdIsFsPath(projectId)),
        Effect.flatMap(({ authToken, projectPath }) =>
          pipe(
            pullFromRemoteGitRepo({
              isoGitFs,
              isoGitHttp,
              dir: projectPath,
              remote: remoteName,
              authToken,
            }),
            Effect.catchTag(VersionControlRepositoryErrorTag, (err) =>
              Effect.fail(new RepositoryError(err.message))
            )
          )
        )
      );

  const getRemoteBranchInfo: MultiDocumentProjectStore['getRemoteBranchInfo'] =
    ({ projectId, remoteName = 'origin', authToken: authTokenInput }) =>
      Effect.Do.pipe(
        Effect.bind('authToken', () =>
          ensureAuthTokenIsProvided(authTokenInput)
        ),
        Effect.bind('projectPath', () => ensureProjectIdIsFsPath(projectId)),
        Effect.flatMap(({ projectPath, authToken }) =>
          pipe(
            findGitRemoteByName({
              isoGitFs,
              dir: projectPath,
              name: remoteName,
            }),
            Effect.catchTag(VersionControlRepositoryErrorTag, (err) =>
              Effect.fail(new RepositoryError(err.message))
            ),
            Effect.catchTag(VersionControlNotFoundErrorTag, (err) =>
              Effect.fail(new NotFoundError(err.message))
            ),
            Effect.flatMap((remoteInfo) =>
              pipe(
                getRemoteBranchInfoWithGit({
                  isoGitHttp,
                  url: remoteInfo.url,
                  authToken,
                }),
                Effect.catchAll((err) =>
                  Effect.fail(new RepositoryError(err.message))
                )
              )
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
    commitChanges,
    createAndSwitchToBranch,
    switchToBranch,
    getCurrentBranch,
    listBranches,
    deleteBranch,
    mergeAndDeleteBranch,
    getMergeConflictInfo,
    abortMerge,
    resolveConflictByKeepingDocument,
    resolveConflictByDeletingDocument,
    commitMergeConflictsResolution,
    setAuthorInfo,
    addRemoteProject,
    listRemoteProjects,
    findRemoteProjectByName,
    pushToRemoteProject,
    pullFromRemoteProject,
    getRemoteBranchInfo,
  };
};
