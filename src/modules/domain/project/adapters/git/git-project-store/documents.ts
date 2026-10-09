import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as Option from 'effect/Option';
import git, { type PromiseFsClient as IsoGitFsApi } from 'isomorphic-git';

import {
  parsePlainTextDocument,
  type PlainTextDocument,
} from '../../../../../../modules/domain/plain-text';
import {
  type DocumentAnalysisError,
  DocumentAnalysisErrorTag,
  type DocumentAnalyzer,
  type RichTextLibError,
  RichTextLibErrorTag,
} from '../../../../../../modules/domain/rich-text';
import {
  CURRENT_SCHEMA_VERSION,
  PRIMARY_RICH_TEXT_REPRESENTATION,
  type ResolvedDocument,
  type RichTextDocument,
} from '../../../../../../modules/domain/rich-text/models';
import {
  AccessControlError as FilesystemAccessControlError,
  DataIntegrityError as FilesystemDataIntegrityError,
  type Filesystem,
  FilesystemAccessControlErrorTag,
  FilesystemDataIntegrityErrorTag,
  FilesystemNotFoundErrorTag,
  FilesystemRepositoryErrorTag,
  NotFoundError as FilesystemNotFoundError,
  RepositoryError as FilesystemRepositoryError,
} from '../../../../../../modules/infrastructure/filesystem';
import {
  type ArtifactId,
  type Change,
  type ChangeId,
  type Commit,
  commitStagedChanges as commitStagedChangesInGit,
  createGitBlobRef,
  fileExistsAtCommit,
  getFileCommitHistory,
  type GitCommitHash,
  hasStagedChanges,
  isGitCommitHash,
  isUncommittedChangeId,
  MigrationError,
  parseGitCommitHash,
  parseGitCommitHashEffect,
  readBlobAtCommit,
  removeFile as removeFileFromGit,
  type UncommitedChange,
  UNCOMMITTED_CHANGE_ID,
  VersionControlNotFoundErrorTag,
  VersionControlRepositoryErrorTag,
} from '../../../../../../modules/infrastructure/version-control';
import { unique } from '../../../../../../utils/array';
import { type Mutex } from '../../../../../../utils/effect';
import { mapErrorTo } from '../../../../../../utils/errors';
import {
  DeletedDocumentError,
  NotFoundError,
  RepositoryError,
  TextDecodingError,
  ValidationError,
  VersionedProjectDeletedDocumentErrorTag,
  VersionedProjectNotFoundErrorTag,
} from '../../../errors';
import {
  artifactKinds,
  canReferenceAssets,
  docRelToProjectRel,
  inferArtifactKindFromExtension,
  parseProjectRelPathEffect,
  type ProjectFsPath,
  type ProjectId,
  type ProjectRelPath,
  type ReferencedAsset,
} from '../../../models';
import { type FindDocumentByIdArgs, type ProjectStore } from '../../../ports';
import { extractArtifactRelativePathFromId } from './artifacts';
import { readAssetBytes } from './assets';
import { getCurrentBranch, whileDocumentRefIsCheckedOut } from './branching';
import { listProjectArtifacts } from './project';
import { ensureProjectIdIsFsPath } from './project-id';

export const getDocumentReferencedAssetPaths = ({
  filesystem,
  documentAnalyzer,
  projectPath,
  documentPath,
}: {
  filesystem: Filesystem;
  documentAnalyzer: DocumentAnalyzer;
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
  if (!canReferenceAssets(inferArtifactKindFromExtension(documentPath))) {
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

const decodePlainText =
  (documentPath: string) =>
  (
    bytes: Uint8Array
  ): Effect.Effect<PlainTextDocument, TextDecodingError, never> =>
    pipe(
      parsePlainTextDocument(bytes),
      Effect.mapError(
        (error) =>
          new TextDecodingError(
            `"${documentPath}" could not be read as text. ${error.message}.`
          )
      )
    );

type DocumentOps = Pick<
  ProjectStore,
  | 'createDocument'
  | 'findDocumentById'
  | 'findPlainTextDocumentById'
  | 'getDocumentLastChangeId'
  | 'updateRichTextDocumentContent'
  | 'updatePlainTextDocumentContent'
  | 'deleteDocument'
  | 'deleteDocuments'
  | 'getDocumentHistory'
  | 'getDocumentAtChange'
  | 'getPlainTextDocumentAtChange'
  | 'isContentSameAtChanges'
  | 'discardUncommittedChanges'
  | 'resolveContentConflict'
  | 'lookupArtifactInProject'
  | 'findDocumentByPath'
  | 'readDocumentReferencedAssets'
>;

export const createDocumentOps = ({
  isoGitFs,
  filesystem,
  documentAnalyzer,
  currentBranchMutex,
}: {
  // We have 2 filesystem APIs because isomorphic-git works well in both browser in Node.js
  // with its own implemented fs APIs, which more or less comply to the Node.js API.
  // In cases where we interact with the filesystem outside isomorphic-git (e.g. for listing files or normailizing paths),
  // we are using our own Filesystem API.
  isoGitFs: IsoGitFsApi;
  filesystem: Filesystem;
  documentAnalyzer: DocumentAnalyzer;
  currentBranchMutex: Mutex;
}): DocumentOps => {
  const buildDocumentAbsolutePathFromId: (args: {
    projectDir: string;
    id: ArtifactId;
  }) => Effect.Effect<string, ValidationError | RepositoryError, never> = ({
    projectDir,
    id,
  }) =>
    pipe(
      extractArtifactRelativePathFromId(id),
      Effect.flatMap((relativeDocumentPath) =>
        pipe(
          filesystem.getAbsolutePath({
            path: relativeDocumentPath,
            dirPath: projectDir,
          }),
          Effect.catchAll(() =>
            Effect.fail(new RepositoryError('Git repo error'))
          )
        )
      )
    );

  const isDocumentModified: (args: {
    projectDir: string;
    documentPath: string;
  }) => Effect.Effect<boolean, RepositoryError | NotFoundError, never> = ({
    projectDir,
    documentPath,
  }) =>
    pipe(
      Effect.tryPromise({
        try: () =>
          git.status({
            fs: isoGitFs,
            dir: projectDir,
            filepath: documentPath,
          }),
        catch: mapErrorTo(RepositoryError, 'Git repo error'),
      }),
      Effect.flatMap((fileChangedStatus) => {
        if (fileChangedStatus === 'ignored' || fileChangedStatus === 'absent') {
          return Effect.fail(
            new NotFoundError('Document is ignored or absent')
          );
        }

        if (fileChangedStatus === 'unmodified') {
          return Effect.succeed(false);
        }

        return Effect.succeed(true);
      })
    );

  const readDocumentBytesAtCommit: (args: {
    projectDir: string;
    documentPath: string;
    commitHash: GitCommitHash;
  }) => Effect.Effect<
    Uint8Array,
    RepositoryError | NotFoundError | DeletedDocumentError,
    never
  > = ({ projectDir, documentPath, commitHash }) => {
    const readDocumentBlobAtCommit = (hash: GitCommitHash) =>
      pipe(
        readBlobAtCommit({
          isoGitFs,
          dir: projectDir,
          commitHash: hash,
          filepath: documentPath,
        }),
        Effect.mapError((error) =>
          error._tag === VersionControlNotFoundErrorTag
            ? new NotFoundError(
                `Document "${documentPath}" not found at commit ${hash}`
              )
            : new RepositoryError('Git repo error')
        )
      );

    return pipe(
      readDocumentBlobAtCommit(commitHash),
      // When the document is not found at this commit, check whether it
      // existed in the parent commit. If it did, this is a deletion
      // (DeletedDocumentError); otherwise the document never existed here
      // (NotFoundError).
      Effect.catchTag(VersionedProjectNotFoundErrorTag, (notFoundError) =>
        pipe(
          Effect.tryPromise({
            try: () =>
              git.readCommit({
                fs: isoGitFs,
                dir: projectDir,
                oid: commitHash,
              }),
            catch: () => notFoundError,
          }),
          Effect.flatMap((commitResult) => {
            const parentOid = commitResult.commit.parent[0] ?? null;
            if (!parentOid) return Effect.fail(notFoundError);

            return pipe(
              parseGitCommitHashEffect(parentOid),
              Effect.flatMap(readDocumentBlobAtCommit),
              // Document not in parent either — never existed here.
              Effect.catchAll(() => Effect.fail(notFoundError)),
              // Document exists in parent but not in this commit — deleted.
              Effect.flatMap(() =>
                Effect.fail(
                  new DeletedDocumentError(notFoundError.message, {
                    parentCommitId: parentOid,
                  })
                )
              )
            );
          })
        )
      )
    );
  };

  const getDocumentAtCommit: (args: {
    projectDir: string;
    documentPath: string;
    commitHash: GitCommitHash;
  }) => Effect.Effect<
    RichTextDocument,
    RepositoryError | NotFoundError | DeletedDocumentError,
    never
  > = (args) =>
    pipe(
      readDocumentBytesAtCommit(args),
      Effect.flatMap((blob) =>
        Effect.try({
          try: () => Buffer.from(blob).toString('utf8'),
          catch: mapErrorTo(RepositoryError, 'Git repo error'),
        })
      ),
      Effect.map((content) => ({
        schemaVersion: CURRENT_SCHEMA_VERSION,
        representation: PRIMARY_RICH_TEXT_REPRESENTATION,
        content,
      }))
    );

  const getPlainTextDocumentAtCommit: (args: {
    projectDir: string;
    documentPath: string;
    commitHash: GitCommitHash;
  }) => Effect.Effect<
    PlainTextDocument,
    RepositoryError | NotFoundError | DeletedDocumentError | TextDecodingError,
    never
  > = (args) =>
    pipe(
      readDocumentBytesAtCommit(args),
      Effect.flatMap(decodePlainText(args.documentPath))
    );

  const getDocumentHashAtCommit: (args: {
    projectDir: string;
    documentPath: string;
    commitHash: GitCommitHash;
  }) => Effect.Effect<string, RepositoryError, never> = ({
    projectDir,
    documentPath,
    commitHash,
  }) =>
    pipe(
      Effect.tryPromise({
        try: () =>
          git.resolveRef({ fs: isoGitFs, dir: projectDir, ref: commitHash }),
        catch: mapErrorTo(RepositoryError, 'Git repo error'),
      }),
      Effect.flatMap((commitOid) =>
        Effect.tryPromise({
          try: () =>
            git.readBlob({
              fs: isoGitFs,
              dir: projectDir,
              oid: commitOid,
              filepath: documentPath,
            }),
          catch: mapErrorTo(RepositoryError, 'Git repo error'),
        })
      ),
      Effect.map((readBlobResult) => readBlobResult.oid)
    );

  const createDocument: DocumentOps['createDocument'] = ({
    projectId,
    parentDirectoryPath,
    name,
  }) =>
    Effect.Do.pipe(
      Effect.bind('projectDir', () => ensureProjectIdIsFsPath(projectId)),
      Effect.bind('filePath', () =>
        parseProjectRelPathEffect(
          parentDirectoryPath ? `${parentDirectoryPath}/${name}` : name
        )
      ),
      Effect.flatMap(({ projectDir, filePath }) =>
        currentBranchMutex(
          pipe(
            getCurrentBranch({ isoGitFs, projectDir }),
            // A detached HEAD has no branch to create the document on.
            Effect.catchTag(VersionedProjectNotFoundErrorTag, (err) =>
              Effect.fail(new RepositoryError(err.message))
            ),
            Effect.flatMap((currentBranch) =>
              Effect.try({
                try: () =>
                  createGitBlobRef({ ref: currentBranch, path: filePath }),
                catch: mapErrorTo(
                  ValidationError,
                  'Cannot create the Git blob ref for the document'
                ),
              })
            ),
            Effect.tap(() =>
              pipe(
                filesystem.getAbsolutePath({
                  path: filePath,
                  dirPath: projectDir,
                }),
                Effect.flatMap((path) =>
                  filesystem.createFile({ path, content: '' })
                )
              )
            )
          )
        )
      ),
      // The filesystem AlreadyExistsError is left intact, so a name collision
      // can be told apart from other failures.
      Effect.catchTags({
        [FilesystemAccessControlErrorTag]: (err) =>
          Effect.fail(new RepositoryError(err.message)),
        [FilesystemNotFoundErrorTag]: (err) =>
          Effect.fail(new NotFoundError(err.message)),
        [FilesystemRepositoryErrorTag]: (err) =>
          Effect.fail(new RepositoryError(err.message)),
      })
    );

  const readDocumentFromWorkdir: (
    args: FindDocumentByIdArgs
  ) => Effect.Effect<
    ResolvedDocument,
    ValidationError | RepositoryError | NotFoundError | MigrationError,
    never
  > = ({ projectId, documentId }) =>
    pipe(
      ensureProjectIdIsFsPath(projectId),
      Effect.flatMap((projectDir) =>
        buildDocumentAbsolutePathFromId({ projectDir, id: documentId })
      ),
      Effect.flatMap((documentPath) =>
        pipe(
          filesystem.readTextFile(documentPath),
          Effect.mapError((error) =>
            error._tag === FilesystemNotFoundErrorTag
              ? new NotFoundError(`File with path ${documentPath} not found`)
              : new RepositoryError('Git repo error')
          )
        )
      ),
      Effect.map(
        ({ content }) =>
          ({
            id: documentId,
            artifact: {
              schemaVersion: CURRENT_SCHEMA_VERSION,
              representation: PRIMARY_RICH_TEXT_REPRESENTATION,
              content,
            },
            handle: null,
          }) as ResolvedDocument
      )
    );

  const findDocumentById: DocumentOps['findDocumentById'] = (args) =>
    currentBranchMutex(
      whileDocumentRefIsCheckedOut({
        isoGitFs,
        projectId: args.projectId,
        documentId: args.documentId,
      })(readDocumentFromWorkdir(args))
    );

  const readPlainTextFromWorkdir: (
    args: FindDocumentByIdArgs
  ) => Effect.Effect<
    PlainTextDocument,
    ValidationError | RepositoryError | NotFoundError | TextDecodingError,
    never
  > = ({ projectId, documentId }) =>
    pipe(
      ensureProjectIdIsFsPath(projectId),
      Effect.flatMap((projectDir) =>
        buildDocumentAbsolutePathFromId({ projectDir, id: documentId })
      ),
      Effect.flatMap((documentPath) =>
        pipe(
          filesystem.readBinaryFile(documentPath),
          Effect.mapError((error) =>
            error._tag === FilesystemNotFoundErrorTag
              ? new NotFoundError(`File with path ${documentPath} not found`)
              : new RepositoryError('Git repo error')
          ),
          Effect.flatMap(({ content }) =>
            decodePlainText(documentPath)(content)
          )
        )
      )
    );

  const findPlainTextDocumentById: DocumentOps['findPlainTextDocumentById'] = (
    args
  ) =>
    currentBranchMutex(
      whileDocumentRefIsCheckedOut({
        isoGitFs,
        projectId: args.projectId,
        documentId: args.documentId,
      })(readPlainTextFromWorkdir(args))
    );

  const getDocumentFromFs: (
    projectId: ProjectId,
    documentId: ArtifactId
  ) => Effect.Effect<
    RichTextDocument,
    ValidationError | RepositoryError | NotFoundError | MigrationError,
    never
  > = (projectId, documentId) =>
    pipe(
      readDocumentFromWorkdir({ projectId, documentId }),
      Effect.map((resolvedDocument) => resolvedDocument.artifact)
    );

  const getDocumentLastChangeId: DocumentOps['getDocumentLastChangeId'] = ({
    projectId,
    documentId,
  }) => {
    const getLastModificationCommitId: (args: {
      projectDir: string;
      documentPath: string;
    }) => Effect.Effect<GitCommitHash, RepositoryError, never> = ({
      projectDir,
      documentPath,
    }) =>
      pipe(
        Effect.tryPromise({
          try: () =>
            git.log({
              fs: isoGitFs,
              dir: projectDir,
              // get only the latest commit affecting the file
              depth: 1,
              filepath: documentPath,
            }),
          catch: mapErrorTo(RepositoryError, 'Git repo error'),
        }),
        Effect.flatMap((commits) =>
          commits.length > 0
            ? Effect.try({
                try: () => parseGitCommitHash(commits[0].oid),
                catch: mapErrorTo(RepositoryError, 'Git repo error'),
              })
            : Effect.fail(
                // TODO: Consider returning a NotFoundError
                // But since we know there is some kind of modification, we must get a commit that modified the document.
                new RepositoryError(
                  'Could not find the last commit that modified the document'
                )
              )
        )
      );

    const getChangeId: (
      modified: boolean
    ) => (args: {
      projectDir: string;
      documentPath: string;
    }) => Effect.Effect<ChangeId, RepositoryError, never> =
      (modified) =>
      ({ projectDir, documentPath }) =>
        modified
          ? Effect.succeed(UNCOMMITTED_CHANGE_ID)
          : getLastModificationCommitId({ documentPath, projectDir });

    return Effect.Do.pipe(
      Effect.bind('projectDir', () => ensureProjectIdIsFsPath(projectId)),
      Effect.bind('documentPath', () =>
        extractArtifactRelativePathFromId(documentId)
      ),
      Effect.flatMap(({ projectDir, documentPath }) =>
        pipe(
          isDocumentModified({ projectDir, documentPath }),
          Effect.flatMap((modified) =>
            getChangeId(modified)({ projectDir, documentPath })
          )
        )
      )
    );
  };

  // Writes the new content to the document's file in the workdir. The store
  // owns the workdir, so the target path is derived from the document id
  // rather than supplied by the caller.
  const writeDocumentToWorkdir: (args: {
    projectId: ProjectId;
    documentId: ArtifactId;
    content: string;
  }) => Effect.Effect<void, RepositoryError, never> = ({
    projectId,
    documentId,
    content,
  }) =>
    pipe(
      ensureProjectIdIsFsPath(projectId),
      Effect.flatMap((projectDir) =>
        buildDocumentAbsolutePathFromId({ projectDir, id: documentId })
      ),
      Effect.flatMap((path) => filesystem.writeFile({ path, content })),
      Effect.catchAll(() => Effect.fail(new RepositoryError('Git repo error')))
    );

  const updateRichTextDocumentContent: DocumentOps['updateRichTextDocumentContent'] =
    (args) =>
      currentBranchMutex(
        whileDocumentRefIsCheckedOut({
          isoGitFs,
          projectId: args.projectId,
          documentId: args.documentId,
        })(writeDocumentToWorkdir(args))
      );

  const updatePlainTextDocumentContent: DocumentOps['updatePlainTextDocumentContent'] =
    (args) =>
      currentBranchMutex(
        whileDocumentRefIsCheckedOut({
          isoGitFs,
          projectId: args.projectId,
          documentId: args.documentId,
        })(writeDocumentToWorkdir(args))
      );

  const deleteDocumentFromFilesystem: (args: {
    projectDir: string;
    documentId: ArtifactId;
    deleteFromFilesystem?: boolean;
  }) => Effect.Effect<void, ValidationError | RepositoryError, never> = ({
    projectDir,
    documentId,
    deleteFromFilesystem,
  }) =>
    deleteFromFilesystem
      ? pipe(
          buildDocumentAbsolutePathFromId({ projectDir, id: documentId }),
          Effect.flatMap((documentPath) =>
            pipe(
              filesystem.deleteFile({ path: documentPath }),
              Effect.catchAll(() =>
                Effect.fail(new RepositoryError('Git repo error'))
              )
            )
          )
        )
      : Effect.succeed(undefined);

  const getDocumentHistory: DocumentOps['getDocumentHistory'] = ({
    projectId,
    documentId,
  }) => {
    const getDocumentCommitHistory = ({
      projectDir: dir,
      documentPath,
    }: {
      projectDir: string;
      documentPath: string;
    }): Effect.Effect<Commit[], RepositoryError, never> =>
      pipe(
        getFileCommitHistory({
          isoGitFs,
          dir,
          filepath: documentPath,
        }),
        Effect.catchTag(VersionControlRepositoryErrorTag, (err) =>
          Effect.fail(new RepositoryError(err.message))
        )
      );

    const getDocumentChangeHistory: (args: {
      modified: boolean;
      commitHistory: Commit[];
    }) => Effect.Effect<
      {
        history: Change[];
        latestChange: Change;
        lastCommit: Commit | null;
        hasUncommittedChanges: boolean;
      },
      RepositoryError | NotFoundError,
      never
    > = ({ modified, commitHistory }) => {
      const lastCommit = commitHistory.length > 0 ? commitHistory[0] : null;

      if (modified) {
        const uncommittedChange: UncommitedChange = {
          id: UNCOMMITTED_CHANGE_ID,
        };

        return Effect.succeed({
          history: [uncommittedChange, ...commitHistory],
          latestChange: uncommittedChange,
          lastCommit,
          hasUncommittedChanges: true,
        });
      }

      return Effect.succeed({
        history: commitHistory,
        // TODO: Handle more gracefully
        latestChange: lastCommit!,
        lastCommit,
        hasUncommittedChanges: false,
      });
    };

    return Effect.Do.pipe(
      Effect.bind('projectDir', () => ensureProjectIdIsFsPath(projectId)),
      Effect.bind('documentPath', () =>
        extractArtifactRelativePathFromId(documentId)
      ),
      Effect.bind('document', () =>
        readDocumentFromWorkdir({ projectId, documentId })
      ),
      Effect.flatMap(({ projectDir, documentPath, document }) =>
        Effect.Do.pipe(
          Effect.bind('documentCommitHistory', () =>
            getDocumentCommitHistory({ documentPath, projectDir })
          ),
          Effect.bind('isModified', () =>
            isDocumentModified({ projectDir, documentPath })
          ),
          Effect.flatMap(({ documentCommitHistory, isModified }) =>
            getDocumentChangeHistory({
              modified: isModified,
              commitHistory: documentCommitHistory,
            })
          ),
          Effect.map(
            ({ history, latestChange, lastCommit, hasUncommittedChanges }) => ({
              history,
              latestChange,
              lastCommit,
              current: document.artifact,
              hasUncommittedChanges,
            })
          )
        )
      )
    );
  };

  const readAtCommittedChange = <A, E>({
    projectId,
    documentId,
    changeId,
    readAtCommit,
  }: {
    projectId: ProjectId;
    documentId: ArtifactId;
    changeId: Change['id'];
    readAtCommit: (args: {
      projectDir: string;
      documentPath: string;
      commitHash: GitCommitHash;
    }) => Effect.Effect<A, E, never>;
  }): Effect.Effect<A, E | ValidationError, never> =>
    Effect.Do.pipe(
      Effect.bind('projectDir', () => ensureProjectIdIsFsPath(projectId)),
      Effect.bind('documentPath', () =>
        extractArtifactRelativePathFromId(documentId)
      ),
      Effect.flatMap(({ projectDir, documentPath }) =>
        pipe(
          Effect.succeed(changeId),
          Effect.filterOrFail(
            isGitCommitHash,
            (val) => new ValidationError(`Invalid commit hash: ${val}`)
          ),
          Effect.flatMap((commitHash) =>
            readAtCommit({
              projectDir,
              documentPath,
              commitHash,
            })
          )
        )
      )
    );

  const getDocumentAtChange: DocumentOps['getDocumentAtChange'] = ({
    projectId,
    documentId,
    changeId,
  }) =>
    isUncommittedChangeId(changeId)
      ? getDocumentFromFs(projectId, documentId)
      : readAtCommittedChange({
          projectId,
          documentId,
          changeId,
          readAtCommit: getDocumentAtCommit,
        });

  const getPlainTextDocumentAtChange: DocumentOps['getPlainTextDocumentAtChange'] =
    ({ projectId, documentId, changeId }) =>
      isUncommittedChangeId(changeId)
        ? readPlainTextFromWorkdir({ projectId, documentId })
        : readAtCommittedChange({
            projectId,
            documentId,
            changeId,
            readAtCommit: getPlainTextDocumentAtCommit,
          });

  const getUncommittedDocumentStateHash: (
    projectId: ProjectId,
    documentId: ArtifactId
  ) => Effect.Effect<
    string,
    ValidationError | RepositoryError | NotFoundError | MigrationError,
    never
  > = (projectId, documentId) =>
    pipe(
      getDocumentFromFs(projectId, documentId),
      Effect.flatMap(({ content }) =>
        Effect.tryPromise({
          try: () =>
            git.hashBlob({
              object: content,
            }),
          catch: mapErrorTo(RepositoryError, 'Git repo error'),
        })
      ),
      Effect.map((hashBlobResult) => hashBlobResult.oid)
    );

  const getDocumentHashAtChange: (args: {
    projectId: ProjectId;
    documentId: ArtifactId;
    changeId: Change['id'];
  }) => Effect.Effect<
    string,
    ValidationError | RepositoryError | NotFoundError | MigrationError,
    never
  > = ({ projectId, documentId, changeId }) => {
    return isUncommittedChangeId(changeId)
      ? getUncommittedDocumentStateHash(projectId, documentId)
      : Effect.Do.pipe(
          Effect.bind('projectDir', () => ensureProjectIdIsFsPath(projectId)),
          Effect.bind('documentPath', () =>
            extractArtifactRelativePathFromId(documentId)
          ),
          Effect.bind('commitHash', () =>
            pipe(
              Effect.succeed(changeId),
              Effect.filterOrFail(
                isGitCommitHash,
                (val) => new ValidationError(`Invalid commit hash: ${val}`)
              )
            )
          ),
          Effect.flatMap(({ projectDir, documentPath, commitHash }) =>
            getDocumentHashAtCommit({
              projectDir,
              documentPath,
              commitHash,
            })
          )
        );
  };

  const isContentSameAtChanges: DocumentOps['isContentSameAtChanges'] = ({
    projectId,
    documentId,
    change1,
    change2,
  }) => {
    if (isUncommittedChangeId(change1) && isUncommittedChangeId(change2)) {
      return Effect.succeed(true);
    }

    return Effect.Do.pipe(
      Effect.bind('hash1', () =>
        getDocumentHashAtChange({ projectId, documentId, changeId: change1 })
      ),
      Effect.bind('hash2', () =>
        getDocumentHashAtChange({ projectId, documentId, changeId: change2 })
      ),
      Effect.map(({ hash1, hash2 }) => hash1 === hash2)
    );
  };

  const restoreDocumentFromLastCommit: DocumentOps['discardUncommittedChanges'] =
    ({ projectId, documentId }) => {
      return Effect.Do.pipe(
        Effect.bind('projectDir', () => ensureProjectIdIsFsPath(projectId)),
        Effect.bind('documentHistory', () =>
          getDocumentHistory({ projectId, documentId })
        ),
        Effect.flatMap(
          ({
            projectDir,
            documentHistory: { lastCommit, hasUncommittedChanges },
          }) => {
            if (!hasUncommittedChanges) {
              return Effect.fail(
                new NotFoundError(
                  'The document does not have uncommitted changes to discard.'
                )
              );
            }

            if (!lastCommit) {
              return Effect.fail(
                new RepositoryError(
                  'The document only has uncommitted changes (and no commits). Cannot restore to a known state.'
                )
              );
            }

            return pipe(
              extractArtifactRelativePathFromId(documentId),
              Effect.flatMap((documentPath) =>
                pipe(
                  Effect.succeed(lastCommit.id),
                  Effect.filterOrFail(
                    isGitCommitHash,
                    (val) => new ValidationError(`Invalid commit hash: ${val}`)
                  ),
                  Effect.flatMap((commitHash) =>
                    getDocumentAtCommit({
                      projectDir,
                      documentPath,
                      commitHash,
                    })
                  ),
                  // If the document was deleted in the last commit, restore
                  // from the parent commit instead.
                  Effect.catchTag(
                    VersionedProjectDeletedDocumentErrorTag,
                    (e) =>
                      e.data.parentCommitId
                        ? pipe(
                            getDocumentAtCommit({
                              projectDir,
                              documentPath,
                              commitHash: parseGitCommitHash(
                                e.data.parentCommitId
                              ),
                            }),
                            // The parent commit itself may also not contain the
                            // document (e.g. consecutive deletions). We don't
                            // recurse further — treat this as unrecoverable.
                            Effect.catchTag(
                              VersionedProjectDeletedDocumentErrorTag,
                              (e) => Effect.fail(new RepositoryError(e.message))
                            )
                          )
                        : Effect.fail(
                            new RepositoryError(
                              'Document was deleted but has no parent commit to restore from.'
                            )
                          )
                  )
                )
              ),
              Effect.flatMap((documentAtCommit) =>
                writeDocumentToWorkdir({
                  projectId,
                  documentId,
                  content: documentAtCommit.content,
                })
              )
            );
          }
        )
      );
    };

  const discardUncommittedChanges: DocumentOps['discardUncommittedChanges'] = (
    args
  ) =>
    currentBranchMutex(
      whileDocumentRefIsCheckedOut({
        isoGitFs,
        projectId: args.projectId,
        documentId: args.documentId,
      })(restoreDocumentFromLastCommit(args))
    );

  const resolveContentConflict: DocumentOps['resolveContentConflict'] = ({
    projectId,
    documentId,
  }) =>
    Effect.Do.pipe(
      Effect.bind('projectDir', () => ensureProjectIdIsFsPath(projectId)),
      Effect.bind('documentPath', () =>
        extractArtifactRelativePathFromId(documentId)
      ),
      Effect.flatMap(({ projectDir, documentPath }) =>
        Effect.tryPromise({
          try: () =>
            git.add({
              fs: isoGitFs,
              dir: projectDir,
              filepath: documentPath,
            }),
          catch: mapErrorTo(RepositoryError, 'Git repo error'),
        })
      )
    );

  const removeDocumentFromGit = ({
    projectDir,
    documentId,
  }: {
    projectDir: string;
    documentId: ArtifactId;
  }) =>
    pipe(
      extractArtifactRelativePathFromId(documentId),
      Effect.flatMap((documentPath) =>
        pipe(
          removeFileFromGit({
            isoGitFs,
            dir: projectDir,
            path: documentPath,
          }),
          Effect.flatMap(() => hasStagedChanges({ isoGitFs, dir: projectDir })),
          Effect.flatMap((hasChanges) =>
            hasChanges
              ? commitStagedChangesInGit({
                  isoGitFs,
                  dir: projectDir,
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

  const removeDocumentsFromGit = ({
    projectDir,
    documentIds,
  }: {
    projectDir: string;
    documentIds: ArtifactId[];
  }) =>
    pipe(
      Effect.forEach(documentIds, extractArtifactRelativePathFromId),
      Effect.flatMap((documentPaths) =>
        pipe(
          Effect.forEach(documentPaths, (docPath) =>
            removeFileFromGit({
              isoGitFs,
              dir: projectDir,
              path: docPath,
            })
          ),
          Effect.flatMap(() => hasStagedChanges({ isoGitFs, dir: projectDir })),
          Effect.flatMap((hasChanges) =>
            hasChanges
              ? commitStagedChangesInGit({
                  isoGitFs,
                  dir: projectDir,
                  message:
                    documentPaths.length === 1
                      ? `Removed ${documentPaths[0]}`
                      : `Removed ${documentPaths.length} files`,
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

  const lookupArtifactInProjectHistory = (
    projectDir: string,
    path: string,
    commitId: GitCommitHash
  ): Effect.Effect<
    ArtifactId,
    NotFoundError | RepositoryError | ValidationError,
    never
  > =>
    pipe(
      fileExistsAtCommit({
        isoGitFs,
        dir: projectDir,
        commitId,
        filepath: path,
      }),
      Effect.catchTag(VersionControlNotFoundErrorTag, () =>
        Effect.fail(
          new NotFoundError(
            `File with path ${path} not found at commit ${commitId}`
          )
        )
      ),
      Effect.catchTag(VersionControlRepositoryErrorTag, (err) =>
        Effect.fail(new RepositoryError(err.message))
      ),
      Effect.map(() => createGitBlobRef({ ref: commitId, path }))
    );

  const lookupArtifactInProject: DocumentOps['lookupArtifactInProject'] = ({
    projectId,
    path,
    changeId,
  }) => {
    if (changeId && isGitCommitHash(changeId)) {
      return pipe(
        ensureProjectIdIsFsPath(projectId),
        Effect.flatMap((projectDir) =>
          lookupArtifactInProjectHistory(projectDir, path, changeId)
        )
      );
    }

    return pipe(
      listProjectArtifacts({ isoGitFs, filesystem, id: projectId }),
      Effect.flatMap((artifacts) =>
        pipe(
          Option.fromNullable(
            artifacts.find((artifact) => artifact.path === path)
          ),
          Option.match({
            onNone: () =>
              Effect.fail(
                new NotFoundError(`File with path ${path} not found in project`)
              ),
            onSome: (artifact) => Effect.succeed(artifact.id),
          })
        )
      )
    );
  };

  const deleteDocument: DocumentOps['deleteDocument'] = ({
    projectId,
    documentId,
    deleteFromFilesystem,
  }) =>
    pipe(
      ensureProjectIdIsFsPath(projectId),
      Effect.flatMap((projectDir) =>
        pipe(
          removeDocumentFromGit({ projectDir, documentId }),
          Effect.flatMap(() =>
            deleteDocumentFromFilesystem({
              projectDir,
              documentId,
              deleteFromFilesystem,
            })
          )
        )
      )
    );

  const deleteDocuments: DocumentOps['deleteDocuments'] = ({
    projectId,
    documentIds,
    deleteFromFilesystem,
    directoryPath,
  }) =>
    pipe(
      ensureProjectIdIsFsPath(projectId),
      Effect.flatMap((projectDir) =>
        pipe(
          deleteFromFilesystem && directoryPath
            ? pipe(
                filesystem.deleteDirectory({ path: directoryPath }),
                Effect.catchAll(() =>
                  Effect.fail(
                    new RepositoryError('Could not delete document directory')
                  )
                )
              )
            : Effect.void,
          Effect.flatMap(() =>
            removeDocumentsFromGit({ projectDir, documentIds })
          ),
          Effect.flatMap(() =>
            // The folder has already been deleted earlier in the pipeline.
            Effect.forEach(documentIds, (documentId) =>
              deleteDocumentFromFilesystem({
                projectDir,
                documentId,
                deleteFromFilesystem: false,
              })
            )
          ),
          Effect.asVoid
        )
      )
    );

  const findDocumentByPath: DocumentOps['findDocumentByPath'] = ({
    projectId,
    documentPath,
    changeId,
  }) =>
    pipe(
      Effect.succeed(documentPath),
      Effect.filterOrFail(
        (path) =>
          inferArtifactKindFromExtension(path) ===
          artifactKinds.RICH_TEXT_DOCUMENT,
        () =>
          new ValidationError(
            `Path ${documentPath} is not a rich-text document`
          )
      ),
      Effect.flatMap(() =>
        lookupArtifactInProject({ projectId, path: documentPath, changeId })
      ),
      Effect.flatMap((documentId) =>
        readDocumentFromWorkdir({ projectId, documentId })
      )
    );

  const readDocumentReferencedAssets: DocumentOps['readDocumentReferencedAssets'] =
    ({ projectId, documentId }) =>
      pipe(
        Effect.Do.pipe(
          Effect.bind('projectPath', () => ensureProjectIdIsFsPath(projectId)),
          Effect.bind('documentPath', () =>
            extractArtifactRelativePathFromId(documentId)
          ),
          Effect.bind('referencedAssetPaths', ({ projectPath, documentPath }) =>
            getDocumentReferencedAssetPaths({
              filesystem,
              documentAnalyzer,
              projectPath,
              documentPath,
            })
          ),
          Effect.flatMap(({ referencedAssetPaths }) =>
            Effect.forEach(referencedAssetPaths, (relPath) =>
              pipe(
                readAssetBytes({ filesystem, projectId, relPath }),
                Effect.map((bytes) => ({ relPath, bytes }) as ReferencedAsset),
                // A referenced asset can be a dangling link (missing on disk);
                // skip it rather than failing the whole read.
                Effect.catchTag(VersionedProjectNotFoundErrorTag, () =>
                  Effect.succeed(null)
                )
              )
            )
          ),
          Effect.map((assets) =>
            assets.filter((asset): asset is ReferencedAsset => asset !== null)
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
          [DocumentAnalysisErrorTag]: (err) =>
            Effect.fail(new RepositoryError(err.message)),
          [RichTextLibErrorTag]: (err) =>
            Effect.fail(new RepositoryError(err.message)),
        })
      );

  return {
    createDocument,
    findDocumentById,
    findPlainTextDocumentById,
    getDocumentLastChangeId,
    updateRichTextDocumentContent,
    updatePlainTextDocumentContent,
    deleteDocument,
    deleteDocuments,
    getDocumentHistory,
    getDocumentAtChange,
    getPlainTextDocumentAtChange,
    isContentSameAtChanges,
    discardUncommittedChanges,
    resolveContentConflict,
    lookupArtifactInProject,
    findDocumentByPath,
    readDocumentReferencedAssets,
  };
};
