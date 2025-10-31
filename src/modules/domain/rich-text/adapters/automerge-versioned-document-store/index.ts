import * as Automerge from '@automerge/automerge/slim';
import { RawString, type Repo } from '@automerge/automerge-repo/slim';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import {
  exportToBinary,
  getArtifactAtCommit,
  getArtifactFromHandle,
  getArtifactHandleAtCommit,
  getArtifactHandleHistory,
  getArtifactHeads,
  getArtifactHistory,
  importFromBinary,
  isArtifactContentSameAtHeads,
  migrateIfNeeded,
  MigrationError,
  type VersionControlId,
  versionedArtifactTypes,
} from '../../../../../modules/infrastructure/version-control';
import { mapErrorTo } from '../../../../../utils/errors';
import { richTextRepresentations } from '../../constants';
import { NotFoundError, RepositoryError } from '../../errors';
import {
  CURRENT_SCHEMA_VERSION,
  type RichTextDocument,
  type VersionedDocument,
  type VersionedDocumentHandle,
} from '../../models';
import { type RichTextDocumentSpan } from '../../models/document/automerge';
import { VersionedDocumentStore } from '../../ports/versioned-document-store';
import { migrations } from './migrations';

export const createAdapter = (
  automergeRepo: Repo,
  projId?: string
): VersionedDocumentStore => {
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
      Effect.map((handle) => handle.url)
    );

  const getDocumentHandleAtCommit: VersionedDocumentStore['getDocumentHandleAtCommit'] =
    ({ documentHandle, heads }) =>
      pipe(
        getArtifactHandleAtCommit({ artifactHandle: documentHandle, heads }),
        Effect.catchTag('VersionControlRepositoryError', (err) =>
          Effect.fail(new RepositoryError(err.message))
        )
      );

  const getDocumentAtCommit: VersionedDocumentStore['getDocumentAtCommit'] = ({
    documentId,
    heads,
  }) =>
    pipe(
      findDocumentById(documentId),
      Effect.flatMap(({ artifact: document }) =>
        getArtifactAtCommit({ artifact: document, heads })
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
            id: documentHandle.url,
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

  const findDocumentHandleById: VersionedDocumentStore['findDocumentHandleById'] =
    (id) =>
      pipe(
        Effect.tryPromise({
          try: () => automergeRepo.find<RichTextDocument>(id),
          catch: (err: unknown) => {
            // TODO: This is not-future proof as it depends on the error message. Find a better way.
            if (err instanceof Error && err.message.includes('unavailable')) {
              return new NotFoundError(err.message);
            }

            return mapErrorTo(RepositoryError, 'Automerge repo error')(err);
          },
        }),
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
    ({ documentId, representation, content }) =>
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

  const getDocumentHeads: VersionedDocumentStore['getDocumentHeads'] = (
    documentId
  ) =>
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
    documentId: VersionControlId
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

  const getDocumentHandleHistory: VersionedDocumentStore['getDocumentHandleHistory'] =
    (handle: VersionedDocumentHandle) =>
      Effect.tryPromise({
        try: () => getArtifactHandleHistory<RichTextDocument>(handle),
        catch: mapErrorTo(RepositoryError, 'Automerge repo error'),
      });

  const isContentSameAtHeads: VersionedDocumentStore['isContentSameAtHeads'] =
    ({ documentId, heads1, heads2 }) =>
      pipe(
        findDocumentById(documentId),
        Effect.map(({ artifact: document }) =>
          isArtifactContentSameAtHeads<RichTextDocument>(
            document,
            heads1,
            heads2
          )
        )
      );

  const commitChanges: VersionedDocumentStore['commitChanges'] = ({
    documentId,
    message,
  }) =>
    pipe(
      findDocumentHandleById(documentId),
      Effect.flatMap((documentHandle) =>
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
      )
    );

  const exportDocumentToBinary: VersionedDocumentStore['exportDocumentToBinary'] =
    (document) =>
      Effect.try({
        try: () => exportToBinary<RichTextDocument>(document),
        catch: mapErrorTo(RepositoryError, 'Automerge repo error'),
      });

  const exportDocumentHandleToBinary: VersionedDocumentStore['exportDocumentHandleToBinary'] =
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
    createDocument,
    getDocumentHandleAtCommit,
    getDocumentAtCommit,
    findDocumentById,
    findDocumentHandleById,
    updateRichTextDocumentContent,
    getDocumentFromHandle,
    deleteDocument,
    getDocumentHistory,
    getDocumentHandleHistory,
    isContentSameAtHeads,
    getDocumentHeads,
    commitChanges,
    exportDocumentHandleToBinary,
    exportDocumentToBinary,
    importDocumentFromBinary,
    disconnect,
  };
};
