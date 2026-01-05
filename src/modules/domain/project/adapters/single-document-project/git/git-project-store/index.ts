import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as Option from 'effect/Option';
import git, {
  HttpClient as IsoGitHttpApi,
  type PromiseFsClient as IsoGitFsApi,
} from 'isomorphic-git';

import {
  type Filesystem,
  FilesystemNotFoundErrorTag,
} from '../../../../../../../modules/infrastructure/filesystem';
import {
  cloneRepository as cloneGitRepo,
  createAndSwitchToBranch as createAndSwitchToBranchWithGit,
  createGitBlobRef,
  DEFAULT_BRANCH,
  deleteBranch as deleteBranchWithGit,
  findRemoteByName as findGitRemoteByName,
  getCurrentBranch as getCurrentBranchWithGit,
  getRemoteBranchInfo as getRemoteBranchInfoWithGit,
  listBranches as listBranchesWithGit,
  listRemotes as listGitRemotes,
  mergeAndDeleteBranch as mergeAndDeleteBranchWithGit,
  MigrationError,
  pullFromRemote as pullFromRemoteGitRepo,
  pushToRemote as pushToRemoteGitRepo,
  setUserInfo as setUserInfoInGit,
  switchToBranch as switchToBranchWithGit,
  validateAndAddRemote,
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
  isoGitHttp,
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
  isoGitHttp: IsoGitHttpApi;
  projectFilePath: ProjectFsPath;
  internalProjectDir: string;
  projectName: string;
  documentInternalPath: string;
}): SingleDocumentProjectStore => {
  const createSingleDocumentProject: SingleDocumentProjectStore['createSingleDocumentProject'] =
    ({ username, email, cloneUrl, authToken: authTokenInput }) =>
      pipe(
        Effect.succeed(projectFilePath),
        Effect.tap(() =>
          cloneUrl
            ? pipe(
                ensureAuthTokenIsProvided(authTokenInput),
                Effect.flatMap((authToken) =>
                  pipe(
                    cloneGitRepo({
                      isoGitFs,
                      isoGitHttp,
                      dir: internalProjectDir,
                      url: cloneUrl,
                      authToken,
                    }),
                    Effect.catchTag(VersionControlRepositoryErrorTag, (err) =>
                      Effect.fail(new RepositoryError(err.message))
                    )
                  )
                )
              )
            : Effect.tryPromise({
                try: () =>
                  git.init({
                    fs: isoGitFs,
                    dir: internalProjectDir,
                    defaultBranch: DEFAULT_BRANCH,
                  }),
                catch: mapErrorTo(RepositoryError, 'Git repo error'),
              })
        ),
        Effect.tap((projectFilePath) =>
          setAuthorInfo({ projectId: projectFilePath, username, email })
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
          filesystem.readTextFile(documentInternalPath),
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

  const setAuthorInfo: SingleDocumentProjectStore['setAuthorInfo'] = ({
    username,
    email,
  }) =>
    pipe(
      setUserInfoInGit({
        isoGitFs,
        dir: internalProjectDir,
        username,
        email,
      }),
      Effect.catchTag(VersionControlRepositoryErrorTag, (err) =>
        Effect.fail(new RepositoryError(err.message))
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

  const addRemoteProject: SingleDocumentProjectStore['addRemoteProject'] = ({
    remoteName = 'origin',
    remoteUrl,
    authToken: authTokenInput,
  }) =>
    pipe(
      ensureAuthTokenIsProvided(authTokenInput),
      Effect.flatMap((authToken) =>
        pipe(
          validateAndAddRemote({
            isoGitFs,
            isoGitHttp,
            dir: internalProjectDir,
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

  const listRemoteProjects: SingleDocumentProjectStore['listRemoteProjects'] =
    () =>
      pipe(
        listGitRemotes({
          isoGitFs,
          dir: internalProjectDir,
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
      );

  const findRemoteProjectByName: SingleDocumentProjectStore['findRemoteProjectByName'] =
    ({ remoteName = 'origin' }) =>
      pipe(
        findGitRemoteByName({
          isoGitFs,
          dir: internalProjectDir,
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
      );

  const pushToRemoteProject: SingleDocumentProjectStore['pushToRemoteProject'] =
    ({ remoteName = 'origin', authToken: authTokenInput }) =>
      pipe(
        ensureAuthTokenIsProvided(authTokenInput),
        Effect.flatMap((authToken) =>
          pipe(
            pushToRemoteGitRepo({
              isoGitFs,
              isoGitHttp,
              dir: internalProjectDir,
              remote: remoteName,
              authToken,
            }),
            Effect.catchTag(VersionControlRepositoryErrorTag, (err) =>
              Effect.fail(new RepositoryError(err.message))
            )
          )
        )
      );

  const pullFromRemoteProject: SingleDocumentProjectStore['pullFromRemoteProject'] =
    ({ remoteName = 'origin', authToken: authTokenInput }) =>
      pipe(
        ensureAuthTokenIsProvided(authTokenInput),
        Effect.flatMap((authToken) =>
          pipe(
            pullFromRemoteGitRepo({
              isoGitFs,
              isoGitHttp,
              dir: internalProjectDir,
              remote: remoteName,
              authToken,
            }),
            Effect.catchTag(VersionControlRepositoryErrorTag, (err) =>
              Effect.fail(new RepositoryError(err.message))
            )
          )
        )
      );

  const getRemoteBranchInfo: SingleDocumentProjectStore['getRemoteBranchInfo'] =
    ({ remoteName = 'origin', authToken: authTokenInput }) =>
      pipe(
        ensureAuthTokenIsProvided(authTokenInput),
        Effect.flatMap((authToken) =>
          pipe(
            findGitRemoteByName({
              isoGitFs,
              dir: internalProjectDir,
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

  // This is a no-op in the Git document repo.
  const disconnect: SingleDocumentProjectStore['disconnect'] = () =>
    Effect.succeed(undefined);

  return {
    supportsBranching: true,
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
    setAuthorInfo,
    addRemoteProject,
    listRemoteProjects,
    findRemoteProjectByName,
    pushToRemoteProject,
    pullFromRemoteProject,
    getRemoteBranchInfo,
    disconnect,
  };
};
