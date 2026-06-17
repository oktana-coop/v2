import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as Option from 'effect/Option';
import git, {
  type HttpClient as IsoGitHttpApi,
  type PromiseFsClient as IsoGitFsApi,
} from 'isomorphic-git';

import {
  type DocumentAnalysisError,
  DocumentAnalysisErrorTag,
  type DocumentAnalyzer,
  PRIMARY_RICH_TEXT_REPRESENTATION,
  type RichTextLibError,
  RichTextLibErrorTag,
  richTextRepresentations,
} from '../../../../../../../modules/domain/rich-text';
import {
  AccessControlError as FilesystemAccessControlError,
  DataIntegrityError as FilesystemDataIntegrityError,
  type Filesystem,
  FilesystemAccessControlErrorTag,
  FilesystemDataIntegrityErrorTag,
  FilesystemNotFoundErrorTag,
  FilesystemRepositoryErrorTag,
  getParentPath,
  NotFoundError as FilesystemNotFoundError,
  RepositoryError as FilesystemRepositoryError,
} from '../../../../../../../modules/infrastructure/filesystem';
import {
  abortMerge as abortGitMerge,
  cloneRepository as cloneGitRepo,
  type Commit,
  commitMergeConflictsResolution as commitMergeConflictsResolutionToGit,
  commitStagedChanges as commitStagedChangesInGit,
  createAndSwitchToBranch as createAndSwitchToBranchWithGit,
  createGitBlobRef,
  decomposeGitBlobRef,
  DEFAULT_BRANCH,
  deleteBranch as deleteBranchWithGit,
  fileExistsAtCommit,
  findRemoteByName as findGitRemoteByName,
  getBranchCommitHistory,
  getChangedFilesForCommit,
  getCurrentBranch as getCurrentBranchWithGit,
  getMergeConflictInfo as getGitRepoMergeConflictInfo,
  getRemoteBranchInfo as getRemoteBranchInfoWithGit,
  getUncommittedFileChanges,
  type GitBlobRef,
  type GitCommitHash,
  hasStagedChanges,
  isGitBlobRef,
  isGitCommitHash,
  isUncommittedChangeId,
  listBranches as listBranchesWithGit,
  listRemotes as listGitRemotes,
  mergeAndDeleteBranch as mergeAndDeleteBranchWithGit,
  pullFromRemote as pullFromRemoteGitRepo,
  pushToRemote as pushToRemoteGitRepo,
  readBlobAtCommit,
  removeFile as removeFileFromGit,
  renameFile as renameFileInGit,
  type ResolvedArtifactId,
  setUserInfo as setUserInfoInGit,
  stageAndCommitChangesToFiles as stageAndCommitChangesToFilesInGit,
  stageAndCommitWorkdirChanges,
  stageFile as stageFileInGit,
  switchToBranch as switchToBranchWithGit,
  validateAndAddRemote,
  VersionControlNotFoundErrorTag,
  VersionControlRepositoryErrorTag,
  versionedArtifactTypes,
  writeGitignore,
} from '../../../../../../../modules/infrastructure/version-control';
import { unique } from '../../../../../../../utils/array';
import { mapErrorTo } from '../../../../../../../utils/errors';
import { DEFAULT_ASSETS_DIR_NAME } from '../../../../constants';
import {
  NotFoundError,
  RepositoryError,
  ValidationError,
} from '../../../../errors';
import {
  type ArtifactMetaData,
  CURRENT_MULTI_DOCUMENT_PROJECT_SCHEMA_VERSION,
  docRelToProjectRel,
  inferArtifactTypeFromExtension,
  isProjectFsPath,
  parseProjectFsPath,
  parseProjectRelPathEffect,
  type ProjectFsPath,
  type ProjectId,
  type ProjectRelPath,
} from '../../../../models';
import { MultiDocumentProjectStore } from '../../../../ports/multi-document-project';

export const createAdapter = ({
  isoGitFs,
  filesystem,
  isoGitHttp,
  documentAnalyzer,
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
  // Folder for new asset insertions, relative to the project root. Defaults
  // to DEFAULT_ASSETS_DIR_NAME; will eventually be sourced from a user
  // setting.
  assetsDirName?: string;
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
            recursive: true,
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
      Effect.map(({ files, currentBranch }) => {
        return files.reduce<{
          documents: Record<ResolvedArtifactId, ArtifactMetaData>;
          assets: Record<ResolvedArtifactId, ArtifactMetaData>;
        }>(
          (acc, file) => {
            // TODO: Handle errors returned by createGitBlobRef
            const artifactId = createGitBlobRef({
              ref: currentBranch,
              path: file.path,
            });
            const isDocument =
              inferArtifactTypeFromExtension(file.path) ===
              versionedArtifactTypes.RICH_TEXT_DOCUMENT;
            const target = isDocument ? acc.documents : acc.assets;
            target[artifactId] = {
              id: artifactId,
              name: file.name,
              path: file.path,
            };
            return acc;
          },
          { documents: {}, assets: {} }
        );
      }),
      Effect.map(({ documents, assets }) => ({
        type: versionedArtifactTypes.MULTI_DOCUMENT_PROJECT,
        schemaVersion: CURRENT_MULTI_DOCUMENT_PROJECT_SCHEMA_VERSION,
        path: id,
        documents,
        assets,
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
  ) => Effect.Effect<ProjectRelPath, ValidationError, never> = (id) =>
    pipe(
      ensureDocumentIdIsGitRef(id),
      Effect.flatMap((gitBlobRef) =>
        parseProjectRelPathEffect(decomposeGitBlobRef(gitBlobRef).path)
      )
    );

  const renameDocumentInProject: MultiDocumentProjectStore['renameDocumentInProject'] =
    ({ projectId, oldDocumentPath, newDocumentPath }) =>
      pipe(
        ensureProjectIdIsFsPath(projectId),
        Effect.flatMap((projectPath) =>
          pipe(
            renameFileInGit({
              isoGitFs,
              dir: projectPath,
              oldPath: oldDocumentPath,
              newPath: newDocumentPath,
            }),
            Effect.flatMap(() =>
              commitStagedChangesInGit({
                isoGitFs,
                dir: projectPath,
                message: `Renamed ${oldDocumentPath} to ${newDocumentPath}`,
              })
            ),
            Effect.catchTag(VersionControlRepositoryErrorTag, (err) =>
              Effect.fail(new RepositoryError(err.message))
            )
          )
        )
      );

  const deleteDocumentFromProject: MultiDocumentProjectStore['deleteDocumentFromProject'] =
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
            Effect.flatMap(() =>
              hasStagedChanges({ isoGitFs, dir: projectPath })
            ),
            Effect.flatMap((hasChanges) =>
              hasChanges
                ? commitStagedChangesInGit({
                    isoGitFs,
                    dir: projectPath,
                    message: `Removed ${documentPath}`,
                  })
                : Effect.succeed(undefined)
            ),
            Effect.catchTag(VersionControlRepositoryErrorTag, (err) =>
              Effect.fail(new RepositoryError(err.message))
            )
          )
        )
      );

  const deleteDocumentsFromProject: MultiDocumentProjectStore['deleteDocumentsFromProject'] =
    ({ projectId, documentIds }) =>
      Effect.Do.pipe(
        Effect.bind('projectPath', () => ensureProjectIdIsFsPath(projectId)),
        Effect.bind('documentPaths', () =>
          Effect.forEach(documentIds, extractDocumentRelativePathFromId)
        ),
        Effect.flatMap(({ projectPath, documentPaths }) =>
          pipe(
            Effect.forEach(documentPaths, (docPath) =>
              removeFileFromGit({
                isoGitFs,
                dir: projectPath,
                path: docPath,
              })
            ),
            Effect.flatMap(() =>
              hasStagedChanges({ isoGitFs, dir: projectPath })
            ),
            Effect.flatMap((hasChanges) =>
              hasChanges
                ? commitStagedChangesInGit({
                    isoGitFs,
                    dir: projectPath,
                    message:
                      documentPaths.length === 1
                        ? `Removed ${documentPaths[0]}`
                        : `Removed ${documentPaths.length} documents`,
                  })
                : Effect.succeed(undefined)
            ),
            Effect.catchTag(VersionControlRepositoryErrorTag, (err) =>
              Effect.fail(new RepositoryError(err.message))
            ),
            Effect.asVoid
          )
        )
      );

  const renameDocumentsInProject: MultiDocumentProjectStore['renameDocumentsInProject'] =
    ({ projectId, documentRenames }) =>
      pipe(
        ensureProjectIdIsFsPath(projectId),
        Effect.flatMap((projectPath) =>
          pipe(
            Effect.forEach(
              documentRenames,
              ({ oldDocumentPath, newDocumentPath }) =>
                renameFileInGit({
                  isoGitFs,
                  dir: projectPath,
                  oldPath: oldDocumentPath,
                  newPath: newDocumentPath,
                })
            ),
            Effect.flatMap(() =>
              commitStagedChangesInGit({
                isoGitFs,
                dir: projectPath,
                message:
                  documentRenames.length === 1
                    ? `Renamed ${documentRenames[0].oldDocumentPath} to ${documentRenames[0].newDocumentPath}`
                    : `Renamed ${documentRenames.length} documents`,
              })
            ),
            Effect.catchTag(VersionControlRepositoryErrorTag, (err) =>
              Effect.fail(new RepositoryError(err.message))
            ),
            Effect.asVoid
          )
        )
      );

  const findDocumentInProjectHistory = (
    projectId: ProjectId,
    documentPath: string,
    commitId: GitCommitHash
  ): Effect.Effect<
    ResolvedArtifactId,
    NotFoundError | RepositoryError | ValidationError,
    never
  > =>
    pipe(
      ensureProjectIdIsFsPath(projectId),
      Effect.flatMap((projectPath) =>
        pipe(
          fileExistsAtCommit({
            isoGitFs,
            dir: projectPath,
            commitId,
            filepath: documentPath,
          }),
          Effect.catchTag(VersionControlNotFoundErrorTag, () =>
            Effect.fail(
              new NotFoundError(
                `Document with path ${documentPath} not found at commit ${commitId}`
              )
            )
          ),
          Effect.catchTag(VersionControlRepositoryErrorTag, (err) =>
            Effect.fail(new RepositoryError(err.message))
          )
        )
      ),
      Effect.map(() => createGitBlobRef({ ref: commitId, path: documentPath }))
    );

  const findDocumentInProject: MultiDocumentProjectStore['findDocumentInProject'] =
    ({ projectId, documentPath, changeId }) => {
      if (changeId && isGitCommitHash(changeId)) {
        return findDocumentInProjectHistory(projectId, documentPath, changeId);
      }

      return pipe(
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
    };

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

  const getDocumentReferencedAssetPaths = ({
    projectPath,
    documentPath,
  }: {
    projectPath: ProjectFsPath;
    documentPath: ProjectRelPath;
  }): Effect.Effect<
    ProjectRelPath[],
    | FilesystemAccessControlError
    | FilesystemNotFoundError
    | FilesystemRepositoryError
    | FilesystemDataIntegrityError
    | DocumentAnalysisError
    | RichTextLibError,
    never
  > => {
    if (PRIMARY_RICH_TEXT_REPRESENTATION !== richTextRepresentations.MARKDOWN) {
      return Effect.succeed([]);
    }

    return pipe(
      filesystem.getAbsolutePath({ path: documentPath, dirPath: projectPath }),
      Effect.flatMap((absolutePath) => filesystem.readTextFile(absolutePath)),
      Effect.flatMap((file) =>
        documentAnalyzer.extractLocalAssetReferences({
          representation: PRIMARY_RICH_TEXT_REPRESENTATION,
          content: file.content,
        })
      ),
      Effect.map((assetRefs) =>
        unique(
          assetRefs.map((docRel) =>
            docRelToProjectRel({ docRel, docPath: documentPath })
          )
        )
      )
    );
  };

  const stageAndCommitChangesToFiles = ({
    projectPath,
    paths,
    message,
  }: {
    projectPath: ProjectFsPath;
    paths: string[];
    message: string;
  }): Effect.Effect<Commit['id'], RepositoryError, never> =>
    pipe(
      stageAndCommitChangesToFilesInGit({
        isoGitFs,
        dir: projectPath,
        paths,
        message,
      }),
      Effect.catchTag(VersionControlRepositoryErrorTag, (err) =>
        Effect.fail(new RepositoryError(err.message))
      )
    );

  const commitDocumentChanges: MultiDocumentProjectStore['commitDocumentChanges'] =
    ({ projectId, documentId, message }) =>
      pipe(
        Effect.Do.pipe(
          Effect.bind('projectPath', () => ensureProjectIdIsFsPath(projectId)),
          Effect.bind('documentPath', () =>
            extractDocumentRelativePathFromId(documentId)
          ),
          // A document can reference an asset that is no longer on disk (a
          // deleted file, or a hand-authored/pasted dangling link). Staging a
          // missing path would fail the whole commit, so we check existence and
          // commit only the assets that are present, reporting the rest.
          Effect.bind('assets', ({ projectPath, documentPath }) =>
            pipe(
              getDocumentReferencedAssetPaths({ projectPath, documentPath }),
              Effect.flatMap((referencedAssetPaths) =>
                Effect.forEach(referencedAssetPaths, (assetPath) =>
                  pipe(
                    filesystem.getAbsolutePath({
                      path: assetPath,
                      dirPath: projectPath,
                    }),
                    Effect.flatMap(filesystem.exists),
                    Effect.map((fileExists) => ({ assetPath, fileExists }))
                  )
                )
              ),
              Effect.map((referencedAssetPathsWithExistsInfo) =>
                referencedAssetPathsWithExistsInfo.reduce<{
                  existing: ProjectRelPath[];
                  skipped: ProjectRelPath[];
                }>(
                  (acc, { assetPath, fileExists }) =>
                    fileExists
                      ? { ...acc, existing: [...acc.existing, assetPath] }
                      : { ...acc, skipped: [...acc.skipped, assetPath] },
                  { existing: [], skipped: [] }
                )
              )
            )
          ),
          Effect.bind('commitId', ({ projectPath, documentPath, assets }) =>
            stageAndCommitChangesToFiles({
              projectPath,
              paths: [documentPath, ...assets.existing],
              message,
            })
          ),
          Effect.map(({ commitId, assets }) => ({
            commitId,
            skippedAssetPaths: assets.skipped,
          }))
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
          [DocumentAnalysisErrorTag]: (err) =>
            Effect.fail(new RepositoryError(err.message)),
          [RichTextLibErrorTag]: (err) =>
            Effect.fail(new RepositoryError(err.message)),
        })
      );

  const writeFileEnsuringParent = ({
    absolutePath,
    content,
  }: {
    absolutePath: string;
    content: Uint8Array | string;
  }): Effect.Effect<void, RepositoryError, never> => {
    return pipe(
      filesystem.ensureDirectory({ path: getParentPath(absolutePath) }),
      Effect.flatMap(() =>
        filesystem.writeFile({ path: absolutePath, content })
      ),
      Effect.catchAll(() =>
        Effect.fail(new RepositoryError('Failed to write restored file'))
      )
    );
  };

  const restoreDocumentChanges: MultiDocumentProjectStore['restoreDocumentChanges'] =
    ({ projectId, documentId, commit, message }) =>
      Effect.Do.pipe(
        Effect.bind('projectPath', () => ensureProjectIdIsFsPath(projectId)),
        Effect.bind('documentPath', () =>
          extractDocumentRelativePathFromId(documentId)
        ),
        Effect.bind('restoreData', ({ projectPath, documentPath }) =>
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
                  dir: projectPath,
                  commitHash,
                  filepath: documentPath,
                }),
                Effect.catchTag(VersionControlNotFoundErrorTag, (err) =>
                  Effect.fail(new NotFoundError(err.message))
                ),
                Effect.catchTag(VersionControlRepositoryErrorTag, (err) =>
                  Effect.fail(new RepositoryError(err.message))
                )
              )
            ),
            // Scan the historical doc content for asset refs.
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
                            docPath: documentPath,
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
            // An asset referenced by the historical document may be absent from
            // the commit, or fail to read (e.g. a corrupt object). A single bad
            // asset must not abort the whole restore, so we skip any we cannot
            // read and restore the document plus the assets that are present,
            // reporting the rest.
            Effect.bind('assets', ({ commitHash, referencedAssetPaths }) =>
              pipe(
                Effect.forEach(referencedAssetPaths, (path) =>
                  pipe(
                    readBlobAtCommit({
                      isoGitFs,
                      dir: projectPath,
                      commitHash,
                      filepath: path,
                    }),
                    Effect.map(
                      (bytes) => ({ path, bytes, restored: true }) as const
                    ),
                    Effect.catchTags({
                      [VersionControlNotFoundErrorTag]: () =>
                        Effect.succeed({ path, restored: false } as const),
                      [VersionControlRepositoryErrorTag]: () =>
                        Effect.succeed({ path, restored: false } as const),
                    })
                  )
                ),
                Effect.map((entries) =>
                  entries.reduce<{
                    toRestore: { path: ProjectRelPath; bytes: Uint8Array }[];
                    skipped: ProjectRelPath[];
                  }>(
                    (acc, entry) =>
                      entry.restored
                        ? {
                            ...acc,
                            toRestore: [
                              ...acc.toRestore,
                              { path: entry.path, bytes: entry.bytes },
                            ],
                          }
                        : { ...acc, skipped: [...acc.skipped, entry.path] },
                    { toRestore: [], skipped: [] }
                  )
                )
              )
            ),
            Effect.map(({ docBytes, assets }) => ({
              filesToRestore: [
                { path: documentPath, bytes: docBytes },
                ...assets.toRestore,
              ],
              skippedAssetPaths: assets.skipped,
            }))
          )
        ),
        Effect.tap(({ projectPath, restoreData }) =>
          Effect.forEach(
            restoreData.filesToRestore,
            ({ path, bytes }) =>
              pipe(
                filesystem.getAbsolutePath({ path, dirPath: projectPath }),
                Effect.flatMap((absPath) =>
                  writeFileEnsuringParent({
                    absolutePath: absPath,
                    content: bytes,
                  })
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
        Effect.bind('commitId', ({ projectPath, restoreData }) =>
          stageAndCommitChangesToFiles({
            projectPath,
            paths: restoreData.filesToRestore.map((f) => f.path),
            message: message ?? `Restore ${commit.message}`,
          })
        ),
        Effect.map(({ commitId, restoreData }) => ({
          commitId,
          skippedAssetPaths: restoreData.skippedAssetPaths,
        }))
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

  const getProjectCommitHistory: MultiDocumentProjectStore['getProjectCommitHistory'] =
    ({ projectId, branch, limit }) =>
      pipe(
        ensureProjectIdIsFsPath(projectId),
        Effect.flatMap((projectPath) =>
          pipe(
            getBranchCommitHistory({
              isoGitFs,
              dir: projectPath,
              branch,
              limit,
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

  const getChangedDocumentsAtChange: MultiDocumentProjectStore['getChangedDocumentsAtChange'] =
    ({ projectId, changeId }) =>
      pipe(
        ensureProjectIdIsFsPath(projectId),
        Effect.flatMap((projectPath) =>
          isUncommittedChangeId(changeId)
            ? pipe(
                getUncommittedFileChanges({
                  isoGitFs,
                  dir: projectPath,
                }),
                Effect.catchTag(VersionControlRepositoryErrorTag, (err) =>
                  Effect.fail(new RepositoryError(err.message))
                )
              )
            : pipe(
                Effect.succeed(changeId),
                Effect.filterOrFail(
                  isGitCommitHash,
                  (val) =>
                    new ValidationError(`Invalid commit hash: ${String(val)}`)
                ),
                Effect.flatMap((commitHash) =>
                  getChangedFilesForCommit({
                    isoGitFs,
                    dir: projectPath,
                    commitId: commitHash,
                  })
                ),
                Effect.catchTag(VersionControlRepositoryErrorTag, (err) =>
                  Effect.fail(new RepositoryError(err.message))
                )
              )
        )
      );

  const addAssetToProject: MultiDocumentProjectStore['addAssetToProject'] = ({
    projectId,
    name,
    content,
  }) =>
    pipe(
      Effect.Do.pipe(
        Effect.bind('projectPath', () => ensureProjectIdIsFsPath(projectId)),
        Effect.bind('currentBranch', () => getCurrentBranch({ projectId })),
        Effect.bind('relPath', () =>
          Effect.succeed(`${assetsDirName}/${name}`)
        ),
        // Make sure the assets directory exists before writing into it.
        Effect.tap(({ projectPath }) =>
          pipe(
            filesystem.getAbsolutePath({
              path: assetsDirName,
              dirPath: projectPath,
            }),
            Effect.flatMap((absDir) =>
              filesystem.ensureDirectory({ path: absDir })
            )
          )
        ),
        // Resolve the asset's absolute path and write the bytes.
        Effect.tap(({ projectPath, relPath }) =>
          pipe(
            filesystem.getAbsolutePath({ path: relPath, dirPath: projectPath }),
            Effect.flatMap((absPath) =>
              filesystem.writeFile({ path: absPath, content })
            )
          )
        ),
        // Stage the new file.
        Effect.tap(({ projectPath, relPath }) =>
          stageFileInGit({ isoGitFs, dir: projectPath, path: relPath })
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

  const lookupAssetByName: MultiDocumentProjectStore['lookupAssetByName'] = ({
    projectId,
    name,
  }) =>
    pipe(
      Effect.Do.pipe(
        Effect.bind('projectPath', () => ensureProjectIdIsFsPath(projectId)),
        Effect.bind('currentBranch', () => getCurrentBranch({ projectId })),
        Effect.bind('relPath', () =>
          Effect.succeed(`${assetsDirName}/${name}`)
        ),
        Effect.bind('absolutePath', ({ projectPath, relPath }) =>
          filesystem.getAbsolutePath({ path: relPath, dirPath: projectPath })
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

  const listProjectAssets: MultiDocumentProjectStore['listProjectAssets'] = (
    id
  ) =>
    pipe(
      findProjectById(id),
      Effect.map((project) => Object.values(project.assets))
    );

  const readAssetBytes: MultiDocumentProjectStore['readAssetBytes'] = ({
    projectId,
    relPath,
  }) =>
    pipe(
      Effect.Do.pipe(
        Effect.bind('projectPath', () => ensureProjectIdIsFsPath(projectId)),
        Effect.bind('absolutePath', ({ projectPath }) =>
          filesystem.getAbsolutePath({ path: relPath, dirPath: projectPath })
        ),
        Effect.tap(({ projectPath, absolutePath }) =>
          pipe(
            filesystem.isDescendantPath({
              parent: projectPath,
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

  const getProjectRelativePath: MultiDocumentProjectStore['getProjectRelativePath'] =
    ({ projectId, absolutePath }) =>
      pipe(
        filesystem.isDescendantPath({
          parent: projectId,
          possibleDescendant: absolutePath,
        }),
        Effect.flatMap((isInside) =>
          isInside
            ? filesystem.getRelativePath({
                path: absolutePath,
                relativeTo: projectId,
              })
            : Effect.succeed(null)
        ),
        Effect.catchTag(FilesystemRepositoryErrorTag, (err) =>
          Effect.fail(new RepositoryError(err.message))
        )
      );

  // TODO(assets): explicit asset deletion is deferred — orphan cleanup will
  // be handled by a later "prune unreferenced assets" pass.
  const deleteAssetFromProject: MultiDocumentProjectStore['deleteAssetFromProject'] =
    () =>
      Effect.fail(new RepositoryError('Asset deletion is not yet implemented'));

  return {
    supportsBranching: true,
    assetsDirName,
    createProject,
    findProjectById,
    listProjectDocuments,
    addDocumentToProject,
    deleteDocumentFromProject,
    deleteDocumentsFromProject,
    renameDocumentInProject,
    renameDocumentsInProject,
    findDocumentInProject,
    addAssetToProject,
    deleteAssetFromProject,
    lookupAssetByName,
    listProjectAssets,
    readAssetBytes,
    getProjectRelativePath,
    commitChanges,
    commitDocumentChanges,
    restoreDocumentChanges,
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
    getProjectCommitHistory,
    getChangedDocumentsAtChange,
  };
};
