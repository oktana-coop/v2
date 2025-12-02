import * as Automerge from '@automerge/automerge/slim';
import { RawString, type Repo } from '@automerge/automerge-repo/slim';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import {
  type Commit,
  exportToBinary,
  getArtifactAtCommit,
  getArtifactFromHandle,
  getArtifactHandleAtCommit,
  getArtifactHandleHistory,
  getArtifactHeads,
  getArtifactHistory,
  importFromBinary,
  isArtifactContentSameAtHeads,
  isAutomergeUrl,
  isAutomergeUrlHeads,
  migrateIfNeeded,
  MigrationError,
  type ResolvedArtifactId,
  versionedArtifactTypes,
} from '../../../../../../../modules/infrastructure/version-control';
import { fromNullable } from '../../../../../../../utils/effect';
import { mapErrorTo } from '../../../../../../../utils/errors';
import { type Filesystem } from '../../../../../../infrastructure/filesystem';
import { richTextRepresentations } from '../../../../constants';
import {
  NotFoundError,
  RepositoryError,
  ValidationError,
} from '../../../../errors';
import {
  CURRENT_SCHEMA_VERSION,
  type RichTextDocument,
  type VersionedDocument,
  type VersionedDocumentHandle,
} from '../../../../models';
import {
  getSpansString,
  type RichTextDocumentSpan,
} from '../../../../models/document/automerge';
import {
  type RealtimeVersionedDocumentStore,
  type VersionedDocumentStore,
} from '../../../../ports/versioned-document-store';
import { migrations } from './migrations';

export const createAdapter = ({
  automergeRepo,
  projectId: projId,
  filesystem,
  managesFilesystemWorkdir,
}: {
  automergeRepo: Repo;
  projectId?: string;
  filesystem?: Filesystem;
  managesFilesystemWorkdir: boolean;
}): RealtimeVersionedDocumentStore => {
  // This is not an ideal model but we want to be able to tell that the document store we are searching in is the desired one.
  // Without this we are risking registering interest in documents from other repositories (and therefore polluting our stores)
  let projectId: string | null = projId ?? null;
  const setProjectId: VersionedDocumentStore['setProjectId'] = (id) =>
    Effect.sync(() => {
      projectId = id;
    });

  const getDocumentFromHandle: (
    handle: VersionedDocumentHandle
  ) => Effect.Effect<
    VersionedDocument,
    RepositoryError | NotFoundError | MigrationError,
    never
  > = (handle) =>
    pipe(
      getArtifactFromHandle<RichTextDocument>(handle),
      Effect.catchTags({
        VersionControlRepositoryError: (err) =>
          Effect.fail(new RepositoryError(err.message)),
        VersionControlNotFoundError: (err) =>
          Effect.fail(new NotFoundError(err.message)),
      })
    );

  const createDocument: VersionedDocumentStore['createDocument'] = ({
    content,
  }) =>
    pipe(
      Effect.try({
        try: () =>
          automergeRepo.create<RichTextDocument>({
            type: versionedArtifactTypes.RICH_TEXT_DOCUMENT,
            schemaVersion: CURRENT_SCHEMA_VERSION,
            representation: richTextRepresentations.AUTOMERGE,
            content: content ?? '',
          }),
        catch: mapErrorTo(RepositoryError, 'Automerge repo error'),
      }),
      Effect.map((handle) => handle.url as ResolvedArtifactId)
    );

  const getDocumentHandleAtChange: RealtimeVersionedDocumentStore['getDocumentHandleAtChange'] =
    ({ documentHandle, changeId }) =>
      pipe(
        Effect.succeed(changeId),
        Effect.filterOrFail(
          isAutomergeUrlHeads,
          (val) => new ValidationError(`Invalid commit id: ${val}`)
        ),
        Effect.flatMap((commitHeads) =>
          getArtifactHandleAtCommit({
            artifactHandle: documentHandle,
            heads: commitHeads,
          })
        ),
        Effect.catchTag('VersionControlRepositoryError', (err) =>
          Effect.fail(new RepositoryError(err.message))
        )
      );

  const getDocumentAtChange: VersionedDocumentStore['getDocumentAtChange'] = ({
    documentId,
    changeId,
  }) =>
    Effect.Do.pipe(
      Effect.bind('resolvedDocument', () => findDocumentById(documentId)),
      Effect.bind('commitHeads', () =>
        pipe(
          Effect.succeed(changeId),
          Effect.filterOrFail(
            isAutomergeUrlHeads,
            (val) => new ValidationError(`Invalid commit id: ${val}`)
          )
        )
      ),
      Effect.flatMap(({ resolvedDocument, commitHeads }) =>
        getArtifactAtCommit({
          artifact: resolvedDocument.artifact,
          heads: commitHeads,
        })
      ),
      Effect.catchTag('VersionControlRepositoryError', (err) =>
        Effect.fail(new RepositoryError(err.message))
      )
    );

  const findDocumentById: VersionedDocumentStore['findDocumentById'] = (id) =>
    pipe(
      findDocumentHandleById(id),
      Effect.flatMap((documentHandle) =>
        pipe(
          getDocumentFromHandle(documentHandle),
          Effect.map((document) => ({
            id: documentHandle.url as ResolvedArtifactId,
            artifact: document,
            handle: documentHandle,
          }))
        )
      ),
      Effect.timeoutFail({
        duration: '8 seconds',
        onTimeout: () =>
          new NotFoundError('Timeout in getting document handle'),
      })
    );

  const findDocumentHandleById: RealtimeVersionedDocumentStore['findDocumentHandleById'] =
    (id) =>
      pipe(
        Effect.succeed(id),
        Effect.filterOrFail(
          isAutomergeUrl,
          (val) => new ValidationError(`Invalid document id: ${val}`)
        ),
        Effect.flatMap((automergeUrl) =>
          Effect.tryPromise({
            try: () => automergeRepo.find<RichTextDocument>(automergeUrl),
            catch: (err: unknown) => {
              // TODO: This is not-future proof as it depends on the error message. Find a better way.
              if (err instanceof Error && err.message.includes('unavailable')) {
                return new NotFoundError(err.message);
              }

              return mapErrorTo(RepositoryError, 'Automerge repo error')(err);
            },
          })
        ),
        Effect.tap((handle) =>
          pipe(
            migrateIfNeeded(migrations)(handle, CURRENT_SCHEMA_VERSION),
            Effect.catchTag('VersionControlRepositoryError', () =>
              Effect.fail(new RepositoryError('Automerge repo error'))
            ),
            Effect.catchTag('VersionControlNotFoundError', () =>
              Effect.fail(new NotFoundError('Not found'))
            )
          )
        )
      );

  const updateRichTextDocumentContent: VersionedDocumentStore['updateRichTextDocumentContent'] =
    ({ documentId, representation, content, writeToFileWithPath }) =>
      pipe(
        findDocumentHandleById(documentId),
        Effect.flatMap((documentHandle) =>
          representation === richTextRepresentations.AUTOMERGE
            ? Effect.try({
                try: () => {
                  const newSpans = JSON.parse(
                    content
                  ) as Array<RichTextDocumentSpan>;

                  return documentHandle.change((doc) => {
                    Automerge.updateSpans(
                      doc,
                      ['content'],
                      newSpans.map((span) =>
                        span.type === 'block'
                          ? // Manually create the raw string for block types
                            {
                              ...span,
                              value: {
                                ...span.value,
                                type: new RawString(span.value.type as string),
                              },
                            }
                          : // Inline span as-is
                            span
                      )
                    );
                  });
                },
                catch: mapErrorTo(RepositoryError, 'Automerge repo error'),
              })
            : Effect.try({
                try: () =>
                  documentHandle.change((doc) => {
                    doc.content = content;
                  }),
                catch: mapErrorTo(RepositoryError, 'Automerge repo error'),
              })
        ),
        Effect.tap(() =>
          writeToFileWithPath
            ? pipe(
                fromNullable(
                  managesFilesystemWorkdir,
                  () =>
                    new RepositoryError('This store does not manage a workdir')
                ),
                Effect.flatMap(() =>
                  fromNullable(
                    filesystem,
                    () => new RepositoryError('Missing filesystem config')
                  )
                ),
                Effect.flatMap((filesystem) =>
                  filesystem.writeFile(writeToFileWithPath, content)
                ),
                Effect.catchAll(() =>
                  Effect.fail(new RepositoryError('Automerge repo error'))
                )
              )
            : Effect.succeed(undefined)
        )
      );

  const deleteDocument: VersionedDocumentStore['deleteDocument'] = (
    documentId
  ) =>
    pipe(
      findDocumentHandleById(documentId),
      Effect.tap((documentHandle) =>
        Effect.try({
          try: () => documentHandle.delete(),
          catch: mapErrorTo(RepositoryError, 'Automerge repo error'),
        })
      )
    );

  const getDocumentLastChangeId: VersionedDocumentStore['getDocumentLastChangeId'] =
    (documentId) =>
      pipe(
        findDocumentById(documentId),
        Effect.flatMap(({ artifact: document }) =>
          Effect.try({
            try: () => getArtifactHeads<RichTextDocument>(document),
            catch: mapErrorTo(RepositoryError, 'Automerge repo error'),
          })
        )
      );

  const getDocumentHistory: VersionedDocumentStore['getDocumentHistory'] = (
    documentId: ResolvedArtifactId
  ) =>
    pipe(
      findDocumentById(documentId),
      Effect.flatMap(({ artifact: document }) =>
        Effect.tryPromise({
          try: () => getArtifactHistory<RichTextDocument>(document),
          catch: mapErrorTo(RepositoryError, 'Automerge repo error'),
        })
      )
    );

  const getDocumentHandleHistory: RealtimeVersionedDocumentStore['getDocumentHandleHistory'] =
    (handle: VersionedDocumentHandle) =>
      Effect.tryPromise({
        try: () => getArtifactHandleHistory<RichTextDocument>(handle),
        catch: mapErrorTo(RepositoryError, 'Automerge repo error'),
      });

  const isContentSameAtChanges: VersionedDocumentStore['isContentSameAtChanges'] =
    ({ documentId, change1, change2 }) =>
      Effect.Do.pipe(
        Effect.bind('resolvedDocument', () => findDocumentById(documentId)),
        Effect.bind('commitHeads1', () =>
          pipe(
            Effect.succeed(change1),
            Effect.filterOrFail(
              isAutomergeUrlHeads,
              (val) => new ValidationError(`Invalid commit id: ${val}`)
            )
          )
        ),
        Effect.bind('commitHeads2', () =>
          pipe(
            Effect.succeed(change2),
            Effect.filterOrFail(
              isAutomergeUrlHeads,
              (val) => new ValidationError(`Invalid commit id: ${val}`)
            )
          )
        ),
        Effect.map(({ resolvedDocument, commitHeads1, commitHeads2 }) =>
          isArtifactContentSameAtHeads<RichTextDocument>(
            resolvedDocument.artifact,
            commitHeads1,
            commitHeads2
          )
        )
      );

  const commitChanges: VersionedDocumentStore['commitChanges'] = ({
    documentId,
    message,
  }) =>
    pipe(
      findDocumentHandleById(documentId),
      Effect.tap((documentHandle) =>
        Effect.try({
          try: () =>
            documentHandle.change(
              (doc) => {
                // this is effectively a no-op, but it triggers a change event
                // (not) changing the title of the document, as interfering with the
                // content outside the Prosemirror API will cause loss of formatting
                // eslint-disable-next-line no-self-assign
                doc.type = doc.type;
              },
              {
                message,
                time: new Date().getTime(),
              }
            ),
          catch: mapErrorTo(RepositoryError, 'Automerge repo error'),
        })
      ),
      Effect.flatMap(
        () =>
          // TODO: This is not ideal, we should get the change id from the change operation above.
          // Arguably, using getLastLocalChange would be preferable.
          getDocumentLastChangeId(documentId) as Effect.Effect<
            Commit['id'],
            ValidationError | RepositoryError | NotFoundError | MigrationError,
            never
          >
      )
    );

  const restoreCommit: VersionedDocumentStore['restoreCommit'] = ({
    documentId,
    commit,
    message,
    writeToFileWithPath,
  }) =>
    pipe(
      getDocumentAtChange({
        documentId,
        changeId: commit.id,
      }),
      Effect.flatMap((documentAtCommit) =>
        documentAtCommit.representation === richTextRepresentations.AUTOMERGE
          ? Effect.try({
              try: () => getSpansString(documentAtCommit),
              catch: mapErrorTo(
                RepositoryError,
                'Error getting spans from Automerge document'
              ),
            })
          : Effect.fail(
              new RepositoryError(
                'Only Automerge representation is supported for restore'
              )
            )
      ),
      Effect.tap((documentContentAtCommit) =>
        updateRichTextDocumentContent({
          documentId,
          representation: richTextRepresentations.AUTOMERGE,
          content: documentContentAtCommit,
          writeToFileWithPath,
        })
      ),
      Effect.flatMap(() =>
        commitChanges({
          documentId,
          message: message ?? `Restore ${commit.message}`,
        })
      )
    );

  const exportDocumentToBinary: VersionedDocumentStore['exportDocumentToBinary'] =
    (document) =>
      Effect.try({
        try: () => exportToBinary<RichTextDocument>(document),
        catch: mapErrorTo(RepositoryError, 'Automerge repo error'),
      });

  const exportDocumentHandleToBinary: RealtimeVersionedDocumentStore['exportDocumentHandleToBinary'] =
    (documentHandle) =>
      pipe(
        getDocumentFromHandle(documentHandle),
        Effect.flatMap(exportDocumentToBinary)
      );

  const importDocumentFromBinary: VersionedDocumentStore['importDocumentFromBinary'] =
    (data) =>
      Effect.try({
        try: () => importFromBinary<RichTextDocument>(data),
        catch: mapErrorTo(RepositoryError, 'Automerge repo error'),
      });

  const disconnect: VersionedDocumentStore['disconnect'] = () =>
    Effect.tryPromise({
      try: () => automergeRepo.shutdown(),
      catch: mapErrorTo(
        RepositoryError,
        'Error in disconnecting from the project store'
      ),
    });

  return {
    projectId,
    setProjectId,
    managesFilesystemWorkdir,
    createDocument,
    getDocumentHandleAtChange,
    getDocumentAtChange,
    findDocumentById,
    findDocumentHandleById,
    updateRichTextDocumentContent,
    getDocumentFromHandle,
    deleteDocument,
    getDocumentHistory,
    getDocumentHandleHistory,
    isContentSameAtChanges,
    getDocumentLastChangeId,
    commitChanges,
    restoreCommit,
    exportDocumentHandleToBinary,
    exportDocumentToBinary,
    importDocumentFromBinary,
    disconnect,
  };
};
