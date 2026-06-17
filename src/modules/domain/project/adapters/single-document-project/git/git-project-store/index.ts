import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as Option from 'effect/Option';
import git, {
  HttpClient as IsoGitHttpApi,
  type PromiseFsClient as IsoGitFsApi,
} from 'isomorphic-git';

import {
  DocumentAnalysisErrorTag,
  type DocumentAnalyzer,
  PRIMARY_RICH_TEXT_REPRESENTATION,
  RichTextLibErrorTag,
  richTextRepresentations,
} from '../../../../../../../modules/domain/rich-text';
import {
  type Filesystem,
  FilesystemAccessControlErrorTag,
  FilesystemDataIntegrityErrorTag,
  FilesystemNotFoundErrorTag,
  FilesystemRepositoryErrorTag,
  getParentPath,
} from '../../../../../../../modules/infrastructure/filesystem';
import {
  abortMerge as abortGitMerge,
  cloneRepository as cloneGitRepo,
  commitMergeConflictsResolution as commitMergeConflictsResolutionToGit,
  createAndSwitchToBranch as createAndSwitchToBranchWithGit,
  createGitBlobRef,
  DEFAULT_BRANCH,
  deleteBranch as deleteBranchWithGit,
  findRemoteByName as findGitRemoteByName,
  getCurrentBranch as getCurrentBranchWithGit,
  getMergeConflictInfo as getGitRepoMergeConflictInfo,
  getRemoteBranchInfo as getRemoteBranchInfoWithGit,
  isGitCommitHash,
  listBranches as listBranchesWithGit,
  listRemotes as listGitRemotes,
  mergeAndDeleteBranch as mergeAndDeleteBranchWithGit,
  MigrationError,
  pullFromRemote as pullFromRemoteGitRepo,
  pushToRemote as pushToRemoteGitRepo,
  readBlobAtCommit,
  type ResolvedArtifactId,
  setUserInfo as setUserInfoInGit,
  stageAndCommitChangesToFiles as stageAndCommitChangesToFilesInGit,
  stageAndCommitWorkdirChanges,
  stageFile as stageFileInGit,
  switchToBranch as switchToBranchWithGit,
  validateAndAddRemote,
  VersionControlNotFoundErrorTag,
  VersionControlRepositoryErrorTag,
  writeGitignore,
} from '../../../../../../../modules/infrastructure/version-control';
import { unique } from '../../../../../../../utils/array';
import { mapErrorTo } from '../../../../../../../utils/errors';
import { DEFAULT_ASSETS_DIR_NAME, projectTypes } from '../../../../constants';
import {
  NotFoundError,
  RepositoryError,
  ValidationError,
} from '../../../../errors';
import {
  type ArtifactMetaData,
  type BaseArtifactMetaData,
  CURRENT_SINGLE_DOCUMENT_PROJECT_SCHEMA_VERSION,
  docRelToProjectRel,
  parseProjectRelPath,
  ProjectFsPath,
  type ProjectId,
  type ProjectRelPath,
} from '../../../../models';
import { type SingleDocumentProjectStore } from '../../../../ports';

export const createAdapter = ({
  isoGitFs,
  filesystem,
  isoGitHttp,
  documentAnalyzer,
  projectFilePath,
  internalProjectDir,
  projectName,
  documentInternalPath,
  assetsDirName = DEFAULT_ASSETS_DIR_NAME,
}: {
  // We have 2 filesystem APIs because isomorphic-git works well in both browser in Node.js
  // with its own implemented fs APIs, which more or less comply to the Node.js API.
  // In cases where we interact with the filesystem outside isomorphic-git (e.g. for listing files or normailizing paths),
  // we are using our own Filesystem API.
  isoGitFs: IsoGitFsApi;
  filesystem: Filesystem;
  isoGitHttp: IsoGitHttpApi;
  documentAnalyzer: DocumentAnalyzer;
  projectFilePath: ProjectFsPath;
  internalProjectDir: string;
  projectName: string;
  documentInternalPath: string;
  // Folder for new asset insertions, relative to the internal project dir.
  // Defaults to DEFAULT_ASSETS_DIR_NAME; will eventually be sourced from a
  // user setting.
  assetsDirName?: string;
}): SingleDocumentProjectStore => {
  // Strip the leading `/` - isomorphic-git's `filepath` arg wants a project-relative POSIX path.
  const projectRelativeDocumentPath = parseProjectRelPath(
    documentInternalPath.replace(/^\/+/, '')
  );

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
            : pipe(
                Effect.tryPromise({
                  try: () =>
                    git.init({
                      fs: isoGitFs,
                      dir: internalProjectDir,
                      defaultBranch: DEFAULT_BRANCH,
                    }),
                  catch: mapErrorTo(RepositoryError, 'Git repo error'),
                }),
                Effect.tap(() =>
                  pipe(
                    writeGitignore({ isoGitFs, dir: internalProjectDir }),
                    Effect.catchTag(VersionControlRepositoryErrorTag, (err) =>
                      Effect.fail(new RepositoryError(err.message))
                    )
                  )
                )
              )
        ),
        Effect.tap((projectFilePath) =>
          setAuthorInfo({ projectId: projectFilePath, username, email })
        )
      );

  const findProjectById: SingleDocumentProjectStore['findProjectById'] = (
    projectId
  ) =>
    Effect.Do.pipe(
      Effect.bind('currentBranch', () => getCurrentBranch({ projectId })),
      Effect.bind('documentId', ({ currentBranch }) =>
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
      Effect.tap(() => filesystem.readTextFile(documentInternalPath)),
      Effect.bind('absoluteAssetsDir', () =>
        filesystem.getAbsolutePath({
          path: assetsDirName,
          dirPath: internalProjectDir,
        })
      ),
      Effect.bind('assetFiles', ({ absoluteAssetsDir }) =>
        pipe(
          filesystem.listDirectoryFiles({
            path: absoluteAssetsDir,
            useRelativePath: false,
          }),
          // Assets dir may not exist yet — treat as empty rather than error.
          Effect.catchTag(FilesystemNotFoundErrorTag, () => Effect.succeed([]))
        )
      ),
      Effect.map(({ currentBranch, documentId, assetFiles }) => {
        const assets = assetFiles.reduce<
          Record<ResolvedArtifactId, ArtifactMetaData>
        >((acc, file) => {
          const relPath = `${assetsDirName}/${file.name}`;
          // TODO: Handle errors returned by createGitBlobRef
          const assetId = createGitBlobRef({
            ref: currentBranch,
            path: relPath,
          });
          acc[assetId] = {
            id: assetId,
            name: file.name,
            path: relPath,
          };
          return acc;
        }, {});

        return {
          type: projectTypes.SINGLE_DOCUMENT_PROJECT,
          schemaVersion: CURRENT_SINGLE_DOCUMENT_PROJECT_SCHEMA_VERSION,
          document: { id: documentId },
          assets,
          name: projectName,
        };
      }),
      Effect.catchTags({
        [FilesystemNotFoundErrorTag]: () =>
          Effect.fail(
            new NotFoundError(
              `File with path ${documentInternalPath} not found`
            )
          ),
        [FilesystemRepositoryErrorTag]: (err) =>
          Effect.fail(new RepositoryError(err.message)),
        [FilesystemAccessControlErrorTag]: (err) =>
          Effect.fail(new RepositoryError(err.message)),
        [FilesystemDataIntegrityErrorTag]: (err) =>
          Effect.fail(new RepositoryError(err.message)),
      })
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

  const getMergeConflictInfo: SingleDocumentProjectStore['getMergeConflictInfo'] =
    () =>
      pipe(
        getGitRepoMergeConflictInfo({
          isoGitFs,
          dir: internalProjectDir,
        }),
        Effect.catchTag(VersionControlRepositoryErrorTag, (err) =>
          Effect.fail(new RepositoryError(err.message))
        )
      );

  const abortMerge: SingleDocumentProjectStore['abortMerge'] = () =>
    pipe(
      abortGitMerge({
        isoGitFs,
        dir: internalProjectDir,
      }),
      Effect.catchTag(VersionControlRepositoryErrorTag, (err) =>
        Effect.fail(new RepositoryError(err.message))
      )
    );

  const commitMergeConflictsResolution: SingleDocumentProjectStore['commitMergeConflictsResolution'] =
    ({ message }) =>
      pipe(
        commitMergeConflictsResolutionToGit({
          isoGitFs,
          dir: internalProjectDir,
          message,
        }),
        Effect.catchTag(VersionControlRepositoryErrorTag, (err) =>
          Effect.fail(new RepositoryError(err.message))
        )
      );

  const commitChanges: SingleDocumentProjectStore['commitChanges'] = ({
    message,
  }) =>
    pipe(
      stageAndCommitWorkdirChanges({
        isoGitFs,
        dir: internalProjectDir,
        message,
      }),
      Effect.catchTag(VersionControlRepositoryErrorTag, (err) =>
        Effect.fail(new RepositoryError(err.message))
      )
    );

  const restoreChanges: SingleDocumentProjectStore['restoreChanges'] = ({
    commit,
    message,
  }) =>
    Effect.Do.pipe(
      Effect.bind('filesToRestore', () =>
        Effect.Do.pipe(
          Effect.bind('commitHash', () =>
            pipe(
              Effect.succeed(commit.id),
              Effect.filterOrFail(
                isGitCommitHash,
                (val) => new ValidationError(`Invalid commit hash: ${val}`)
              )
            )
          ),
          Effect.bind('docBytes', ({ commitHash }) =>
            pipe(
              readBlobAtCommit({
                isoGitFs,
                dir: internalProjectDir,
                commitHash,
                filepath: projectRelativeDocumentPath,
              }),
              Effect.catchTag(VersionControlNotFoundErrorTag, (err) =>
                Effect.fail(new NotFoundError(err.message))
              ),
              Effect.catchTag(VersionControlRepositoryErrorTag, (err) =>
                Effect.fail(new RepositoryError(err.message))
              )
            )
          ),
          Effect.bind('referencedAssetPaths', ({ docBytes }) =>
            PRIMARY_RICH_TEXT_REPRESENTATION ===
            richTextRepresentations.MARKDOWN
              ? pipe(
                  documentAnalyzer.extractLocalAssetReferences({
                    representation: PRIMARY_RICH_TEXT_REPRESENTATION,
                    content: new TextDecoder().decode(docBytes),
                  }),
                  Effect.map((assetRefs) =>
                    unique(
                      assetRefs.map((docRel) =>
                        docRelToProjectRel({
                          docRel,
                          docPath: projectRelativeDocumentPath,
                        })
                      )
                    )
                  ),
                  Effect.catchTags({
                    [DocumentAnalysisErrorTag]: (err) =>
                      Effect.fail(new RepositoryError(err.message)),
                    [RichTextLibErrorTag]: (err) =>
                      Effect.fail(new RepositoryError(err.message)),
                  })
                )
              : Effect.succeed([] as ProjectRelPath[])
          ),
          Effect.bind(
            'assetsToRestore',
            ({ commitHash, referencedAssetPaths }) =>
              pipe(
                Effect.forEach(referencedAssetPaths, (path) =>
                  pipe(
                    readBlobAtCommit({
                      isoGitFs,
                      dir: internalProjectDir,
                      commitHash,
                      filepath: path,
                    }),
                    Effect.map((bytes) => ({ path, bytes }) as const),
                    Effect.catchTag(VersionControlNotFoundErrorTag, () =>
                      Effect.succeed(null)
                    )
                  )
                ),
                // Filter-out not-found assets (these become dead refs in the document).
                Effect.map((entries) =>
                  entries.filter(
                    (
                      entry
                    ): entry is { path: ProjectRelPath; bytes: Uint8Array } =>
                      entry !== null
                  )
                ),
                Effect.catchTag(VersionControlRepositoryErrorTag, (err) =>
                  Effect.fail(new RepositoryError(err.message))
                )
              )
          ),
          Effect.map(({ docBytes, assetsToRestore }) => [
            {
              path: projectRelativeDocumentPath,
              bytes: docBytes,
            },
            ...assetsToRestore,
          ])
        )
      ),
      Effect.tap(({ filesToRestore }) =>
        Effect.forEach(
          filesToRestore,
          ({ path, bytes }) =>
            pipe(
              filesystem.getAbsolutePath({
                path,
                dirPath: internalProjectDir,
              }),
              Effect.flatMap((absPath) =>
                pipe(
                  filesystem.ensureDirectory({ path: getParentPath(absPath) }),
                  Effect.flatMap(() =>
                    filesystem.writeFile({ path: absPath, content: bytes })
                  )
                )
              ),
              Effect.catchAll(() =>
                Effect.fail(
                  new RepositoryError('Failed to write restored file')
                )
              )
            ),
          { discard: true }
        )
      ),
      Effect.flatMap(({ filesToRestore }) =>
        pipe(
          stageAndCommitChangesToFilesInGit({
            isoGitFs,
            dir: internalProjectDir,
            paths: filesToRestore.map((f) => f.path),
            message: message ?? `Restore ${commit.message}`,
          }),
          Effect.catchTag(VersionControlRepositoryErrorTag, (err) =>
            Effect.fail(new RepositoryError(err.message))
          )
        )
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

  const addAssetToProject: SingleDocumentProjectStore['addAssetToProject'] = ({
    projectId,
    name,
    content,
  }) =>
    pipe(
      Effect.Do.pipe(
        Effect.bind('currentBranch', () => getCurrentBranch({ projectId })),
        Effect.bind('relPath', () =>
          Effect.succeed(`${assetsDirName}/${name}`)
        ),
        // Make sure the assets directory exists before writing into it.
        Effect.tap(() =>
          pipe(
            filesystem.getAbsolutePath({
              path: assetsDirName,
              dirPath: internalProjectDir,
            }),
            Effect.flatMap((absDir) =>
              filesystem.ensureDirectory({ path: absDir })
            )
          )
        ),
        // Resolve the asset's absolute path and write the bytes.
        Effect.tap(({ relPath }) =>
          pipe(
            filesystem.getAbsolutePath({
              path: relPath,
              dirPath: internalProjectDir,
            }),
            Effect.flatMap((absPath) =>
              filesystem.writeFile({ path: absPath, content })
            )
          )
        ),
        // Stage the new file.
        Effect.tap(({ relPath }) =>
          stageFileInGit({
            isoGitFs,
            dir: internalProjectDir,
            path: relPath,
          })
        ),
        // Produce the asset's git blob ref.
        Effect.flatMap(({ currentBranch, relPath }) =>
          Effect.try({
            try: () => createGitBlobRef({ ref: currentBranch, path: relPath }),
            catch: mapErrorTo(
              ValidationError,
              'Cannot create the Git blob ref for the asset'
            ),
          })
        )
      ),
      Effect.catchTags({
        [FilesystemNotFoundErrorTag]: (err) =>
          Effect.fail(new NotFoundError(err.message)),
        [FilesystemAccessControlErrorTag]: (err) =>
          Effect.fail(new RepositoryError(err.message)),
        [FilesystemRepositoryErrorTag]: (err) =>
          Effect.fail(new RepositoryError(err.message)),
        [VersionControlRepositoryErrorTag]: (err) =>
          Effect.fail(new RepositoryError(err.message)),
      })
    );

  const lookupAssetByName: SingleDocumentProjectStore['lookupAssetByName'] = ({
    projectId,
    name,
  }) =>
    pipe(
      Effect.Do.pipe(
        Effect.bind('currentBranch', () => getCurrentBranch({ projectId })),
        Effect.bind('relPath', () =>
          Effect.succeed(`${assetsDirName}/${name}`)
        ),
        Effect.bind('absolutePath', ({ relPath }) =>
          filesystem.getAbsolutePath({
            path: relPath,
            dirPath: internalProjectDir,
          })
        ),
        Effect.flatMap(({ absolutePath, currentBranch, relPath }) =>
          pipe(
            filesystem.readBinaryFile(absolutePath),
            Effect.map(() =>
              createGitBlobRef({ ref: currentBranch, path: relPath })
            )
          )
        )
      ),
      Effect.catchTags({
        [FilesystemNotFoundErrorTag]: () =>
          Effect.fail(
            new NotFoundError(`No asset named "${name}" in project assets.`)
          ),
        [FilesystemAccessControlErrorTag]: (err) =>
          Effect.fail(new RepositoryError(err.message)),
        [FilesystemRepositoryErrorTag]: (err) =>
          Effect.fail(new RepositoryError(err.message)),
        [FilesystemDataIntegrityErrorTag]: (err) =>
          Effect.fail(new RepositoryError(err.message)),
      })
    );

  const listProjectAssets: SingleDocumentProjectStore['listProjectAssets'] = (
    id
  ) =>
    pipe(
      findProjectById(id),
      Effect.map((project) => Object.values(project.assets))
    );

  /**
   * Reads bytes for an asset path relative to the internal project dir.
   * Guards against path traversal — paths must stay inside the workdir.
   */
  const readAssetBytes: SingleDocumentProjectStore['readAssetBytes'] = ({
    relPath,
  }) =>
    pipe(
      Effect.Do.pipe(
        Effect.bind('absolutePath', () =>
          filesystem.getAbsolutePath({
            path: relPath,
            dirPath: internalProjectDir,
          })
        ),
        Effect.tap(({ absolutePath }) =>
          pipe(
            filesystem.isDescendantPath({
              parent: internalProjectDir,
              possibleDescendant: absolutePath,
            }),
            Effect.filterOrFail(
              (isInside) => isInside,
              () => new ValidationError('Asset path escapes project root')
            )
          )
        ),
        Effect.flatMap(({ absolutePath }) =>
          pipe(
            filesystem.readBinaryFile(absolutePath),
            Effect.map((file) => file.content)
          )
        )
      ),
      Effect.catchTags({
        [FilesystemNotFoundErrorTag]: (err) =>
          Effect.fail(new NotFoundError(err.message)),
        [FilesystemAccessControlErrorTag]: (err) =>
          Effect.fail(new RepositoryError(err.message)),
        [FilesystemRepositoryErrorTag]: (err) =>
          Effect.fail(new RepositoryError(err.message)),
        [FilesystemDataIntegrityErrorTag]: (err) =>
          Effect.fail(new RepositoryError(err.message)),
      })
    );

  // TODO(assets): explicit asset deletion is deferred — orphan cleanup will
  // be handled by a later "prune unreferenced assets" pass.
  const deleteAssetFromProject: SingleDocumentProjectStore['deleteAssetFromProject'] =
    () =>
      Effect.fail(new RepositoryError('Asset deletion is not yet implemented'));

  return {
    supportsBranching: true,
    assetsDirName,
    createSingleDocumentProject,
    findProjectById,
    findDocumentInProject,
    getProjectName,
    addAssetToProject,
    deleteAssetFromProject,
    lookupAssetByName,
    listProjectAssets,
    readAssetBytes,
    createAndSwitchToBranch,
    switchToBranch,
    getCurrentBranch,
    listBranches,
    deleteBranch,
    mergeAndDeleteBranch,
    getMergeConflictInfo,
    abortMerge,
    commitChanges,
    restoreChanges,
    commitMergeConflictsResolution,
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
