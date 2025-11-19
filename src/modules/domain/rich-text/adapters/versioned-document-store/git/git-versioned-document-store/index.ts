import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import git, {
  Errors,
  type PromiseFsClient as IsoGitFsApi,
} from 'isomorphic-git';

import {
  type Change,
  type ChangeId,
  type Commit,
  createGitBlobRef,
  decomposeGitBlobRef,
  DEFAULT_AUTHOR_NAME,
  DEFAULT_BRANCH,
  type GitBlobRef,
  type GitCommitHash,
  isGitBlobRef,
  isGitCommitHash,
  isUncommittedChangeId,
  MigrationError,
  parseGitCommitHash,
  type ResolvedArtifactId,
  type UncommitedChange,
  UNCOMMITTED_CHANGE_ID,
  versionedArtifactTypes,
} from '../../../../../../../modules/infrastructure/version-control';
import { fromNullable } from '../../../../../../../utils/effect';
import { mapErrorTo } from '../../../../../../../utils/errors';
import { type Filesystem } from '../../../../../../infrastructure/filesystem';
import { PRIMARY_RICH_TEXT_REPRESENTATION } from '../../../../constants';
import {
  NotFoundError,
  RepositoryError,
  ValidationError,
} from '../../../../errors';
import {
  CURRENT_SCHEMA_VERSION,
  type ResolvedDocument,
  type RichTextDocument,
} from '../../../../models';
import { type VersionedDocumentStore } from '../../../../ports/versioned-document-store';

export const createAdapter = ({
  isoGitFs,
  filesystem,
  projectId: projId,
  projectDir,
}: {
  // We have 2 filesystem APIs because isomorphic-git works well in both browser in Node.js
  // with its own implemented fs APIs, which more or less comply to the Node.js API.
  // In cases where we interact with the filesystem outside isomorphic-git (e.g. for listing files or normailizing paths),
  // we are using our own Filesystem API.
  isoGitFs: IsoGitFsApi;
  filesystem: Filesystem;
  projectId: string;
  // Project dir is the same with projectId in real filesystem setups.
  // But it is the root path ('/') in virtual filesystems like the SQLite fs.
  // We still want to keep the projectId separate to be able to identify the document store's project correctly.
  projectDir: string;
}): VersionedDocumentStore => {
  // This is not an ideal model but we want to be able to tell that the document store we are searching in is the desired one.
  // Without this we are risking registering interest in documents from other repositories (and therefore polluting our stores)
  let projectId: string = projId;
  const setProjectId: VersionedDocumentStore['setProjectId'] = (id) =>
    Effect.sync(() => {
      projectId = id;
    });

  const validateDocumentId: (
    id: ResolvedArtifactId
  ) => Effect.Effect<GitBlobRef, ValidationError, never> = (id) =>
    pipe(
      Effect.succeed(id),
      Effect.filterOrFail(
        isGitBlobRef,
        (val) => new ValidationError(`Invalid document id: ${val}`)
      )
    );

  const extractDocumentPathFromId: (
    id: ResolvedArtifactId
  ) => Effect.Effect<string, ValidationError, never> = (id) =>
    pipe(
      validateDocumentId(id),
      Effect.map((gitBlobRef) => {
        const { path: documentPath } = decomposeGitBlobRef(gitBlobRef);
        return documentPath;
      })
    );

  const createDocument: VersionedDocumentStore['createDocument'] = ({
    filePath,
    writeToFile,
  }) =>
    pipe(
      fromNullable(
        filePath,
        () =>
          new ValidationError(
            'File path is required when creating a document in the Git repo'
          )
      ),
      Effect.flatMap((path) =>
        pipe(
          Effect.try({
            try: () => {
              // TODO: Make branch a param
              // TODO: Handle errors returned by createGitBlobRef
              const documentId = createGitBlobRef({
                ref: DEFAULT_BRANCH,
                path,
              });
              return documentId;
            },
            catch: mapErrorTo(RepositoryError, 'Git repo error'),
          }),
          Effect.tap(() =>
            writeToFile
              ? pipe(
                  filesystem.writeFile(path, ''),
                  Effect.catchAll(() =>
                    Effect.fail(new RepositoryError('Git repo error'))
                  )
                )
              : Effect.succeed(undefined)
          )
        )
      )
    );

  const findDocumentById: VersionedDocumentStore['findDocumentById'] = (id) =>
    Effect.Do.pipe(
      Effect.bind('relativeDocumentPath', () => extractDocumentPathFromId(id)),
      Effect.bind('documentPath', ({ relativeDocumentPath }) =>
        Effect.succeed([projectDir, relativeDocumentPath].join('/'))
      ),
      Effect.flatMap(({ documentPath }) =>
        pipe(
          filesystem.readFile(documentPath),
          Effect.catchTag('FilesystemNotFoundError', () =>
            Effect.fail(
              new NotFoundError(`File with path ${documentPath} not found`)
            )
          ),
          Effect.catchAll(() =>
            Effect.fail(new RepositoryError('Git repo error'))
          )
        )
      ),
      Effect.map(
        ({ content }) =>
          ({
            id,
            artifact: {
              type: versionedArtifactTypes.RICH_TEXT_DOCUMENT,
              schemaVersion: CURRENT_SCHEMA_VERSION,
              representation: PRIMARY_RICH_TEXT_REPRESENTATION,
              content,
            },
            handle: null,
          }) as ResolvedDocument
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

  const getDocumentLastChangeId: VersionedDocumentStore['getDocumentLastChangeId'] =
    (documentId) => {
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
        Effect.bind('documentPath', () =>
          extractDocumentPathFromId(documentId)
        ),
        Effect.flatMap(({ documentPath }) =>
          pipe(
            isDocumentModified({ projectDir, documentPath }),
            Effect.flatMap((modified) =>
              getChangeId(modified)({ projectDir, documentPath })
            )
          )
        )
      );
    };

  const updateRichTextDocumentContent: VersionedDocumentStore['updateRichTextDocumentContent'] =
    ({ content, writeToFileWithPath }) =>
      pipe(
        fromNullable(
          writeToFileWithPath,
          () =>
            new ValidationError(
              'File path not provided; cannot write to document file'
            )
        ),
        Effect.flatMap((path) => filesystem.writeFile(path, content)),
        Effect.catchAll(() =>
          Effect.fail(new RepositoryError('Git repo error'))
        )
      );

  // This is a no-op in the Git document repo since the relevant operation in the project repo (deleting a document from a project) does it.
  const deleteDocument: VersionedDocumentStore['deleteDocument'] = () =>
    Effect.succeed(undefined);

  const commitChanges: VersionedDocumentStore['commitChanges'] = ({
    documentId,
    message,
  }) =>
    Effect.Do.pipe(
      Effect.bind('documentPath', () => extractDocumentPathFromId(documentId)),
      Effect.flatMap(({ documentPath }) =>
        pipe(
          Effect.tryPromise({
            try: () =>
              git.add({
                fs: isoGitFs,
                dir: projectDir,
                filepath: documentPath,
              }),
            catch: mapErrorTo(RepositoryError, 'Git repo error'),
          }),
          Effect.flatMap(() =>
            Effect.tryPromise({
              try: () =>
                git.commit({
                  fs: isoGitFs,
                  dir: projectDir,
                  author: {
                    name: DEFAULT_AUTHOR_NAME,
                  },
                  message,
                }),
              catch: mapErrorTo(RepositoryError, 'Git repo error'),
            })
          )
        )
      )
    );

  const getDocumentHistory: VersionedDocumentStore['getDocumentHistory'] = (
    documentId
  ) => {
    const getDocumentCommitHistory: (args: {
      projectDir: string;
      documentPath: string;
    }) => Effect.Effect<Commit[], RepositoryError | NotFoundError, never> = ({
      projectDir,
      documentPath,
    }) =>
      pipe(
        Effect.tryPromise({
          try: () =>
            git.log({
              fs: isoGitFs,
              dir: projectDir,
              filepath: documentPath,
            }),
          catch: (err) => {
            if (err instanceof Errors.NotFoundError) {
              return new NotFoundError('No commit found');
            }

            return new RepositoryError('Git repo error');
          },
        }),
        Effect.catchTag('VersionedDocumentNotFoundError', () =>
          Effect.succeed([])
        ),
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

    const getDocumentChangeHistory: (args: {
      modified: boolean;
      commitHistory: Commit[];
    }) => Effect.Effect<
      { history: Change[]; latestChange: Change; lastCommit: Commit | null },
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
        });
      }

      return Effect.succeed({
        history: commitHistory,
        // TODO: Handle more gracefully
        latestChange: lastCommit!,
        lastCommit,
      });
    };

    return Effect.Do.pipe(
      Effect.bind('documentPath', () => extractDocumentPathFromId(documentId)),
      Effect.bind('document', () => findDocumentById(documentId)),
      Effect.flatMap(({ documentPath, document }) =>
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
          Effect.map(({ history, latestChange, lastCommit }) => ({
            history,
            latestChange,
            lastCommit,
            current: document.artifact,
          }))
        )
      )
    );
  };

  const getDocumentFromFs: (
    documentId: ResolvedArtifactId
  ) => Effect.Effect<
    RichTextDocument,
    ValidationError | RepositoryError | NotFoundError | MigrationError,
    never
  > = (documentId) =>
    pipe(
      findDocumentById(documentId),
      Effect.map((resolvedDocument) => resolvedDocument.artifact)
    );

  const getDocumentAtChange: VersionedDocumentStore['getDocumentAtChange'] = ({
    documentId,
    changeId,
  }) => {
    const getDocumentAtCommit: (args: {
      projectDir: string;
      documentPath: string;
      commitHash: GitCommitHash;
    }) => Effect.Effect<RichTextDocument, RepositoryError, never> = ({
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
          pipe(
            Effect.tryPromise({
              try: () =>
                git.readBlob({
                  fs: isoGitFs,
                  dir: projectDir,
                  oid: commitOid,
                  filepath: documentPath,
                }),
              catch: mapErrorTo(RepositoryError, 'Git repo error'),
            }),
            Effect.flatMap(({ blob }) =>
              Effect.try({
                try: () => Buffer.from(blob).toString('utf8'),
                catch: mapErrorTo(RepositoryError, 'Git repo error'),
              })
            )
          )
        ),
        Effect.map((content) => ({
          type: versionedArtifactTypes.RICH_TEXT_DOCUMENT,
          schemaVersion: CURRENT_SCHEMA_VERSION,
          representation: PRIMARY_RICH_TEXT_REPRESENTATION,
          content,
        }))
      );

    return isUncommittedChangeId(changeId)
      ? getDocumentFromFs(documentId)
      : Effect.Do.pipe(
          Effect.bind('documentPath', () =>
            extractDocumentPathFromId(documentId)
          ),
          Effect.flatMap(({ documentPath }) =>
            pipe(
              Effect.succeed(changeId),
              Effect.filterOrFail(
                isGitCommitHash,
                (val) => new ValidationError(`Invalid commit hash: ${val}`)
              ),
              Effect.flatMap((commitHash) =>
                getDocumentAtCommit({ projectDir, documentPath, commitHash })
              )
            )
          )
        );
  };

  const getUncommittedDocumentStateHash: (
    documentId: ResolvedArtifactId
  ) => Effect.Effect<
    string,
    ValidationError | RepositoryError | NotFoundError | MigrationError,
    never
  > = (documentId) =>
    pipe(
      getDocumentFromFs(documentId),
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

  const getDocumentHashAtChange: (args: {
    documentId: ResolvedArtifactId;
    changeId: Change['id'];
  }) => Effect.Effect<
    string,
    ValidationError | RepositoryError | NotFoundError | MigrationError,
    never
  > = ({ documentId, changeId }) =>
    isUncommittedChangeId(changeId)
      ? getUncommittedDocumentStateHash(documentId)
      : Effect.Do.pipe(
          Effect.bind('documentPath', () =>
            extractDocumentPathFromId(documentId)
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
          Effect.flatMap(({ documentPath, commitHash }) =>
            getDocumentHashAtCommit({
              projectDir,
              documentPath,
              commitHash,
            })
          )
        );

  const isContentSameAtChanges: VersionedDocumentStore['isContentSameAtChanges'] =
    ({ documentId, change1, change2 }) => {
      if (isUncommittedChangeId(change1) && isUncommittedChangeId(change2)) {
        return Effect.succeed(true);
      }

      return Effect.Do.pipe(
        Effect.bind('hash1', () =>
          getDocumentHashAtChange({ documentId, changeId: change1 })
        ),
        Effect.bind('hash2', () =>
          getDocumentHashAtChange({ documentId, changeId: change2 })
        ),
        Effect.map(({ hash1, hash2 }) => hash1 === hash2)
      );
    };

  // This is a no-op in the Git document repo.
  const disconnect: VersionedDocumentStore['disconnect'] = () =>
    Effect.succeed(undefined);

  return {
    projectId,
    setProjectId,
    createDocument,
    findDocumentById,
    getDocumentLastChangeId,
    updateRichTextDocumentContent,
    deleteDocument,
    commitChanges,
    getDocumentHistory,
    getDocumentAtChange,
    isContentSameAtChanges,
    disconnect,
  };
};
