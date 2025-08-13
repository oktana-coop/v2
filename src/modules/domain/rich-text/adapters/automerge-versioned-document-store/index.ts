import { next as Automerge } from '@automerge/automerge/slim';
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
  importFromBinary,
  isArtifactContentSameAtHeads,
  type VersionControlId,
  versionedArtifactTypes,
} from '../../../../../modules/infrastructure/version-control';
import { mapErrorTo } from '../../../../../utils/errors';
import { NotFoundError, RepositoryError } from '../../errors';
import {
  type RichTextDocument,
  type VersionedDocument,
  type VersionedDocumentHandle,
} from '../../models';
import { VersionedDocumentStore } from '../../ports/versioned-document-store';

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
    RepositoryError | NotFoundError,
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
    document,
    heads,
  }) =>
    pipe(
      getArtifactAtCommit({ artifact: document, heads }),
      Effect.catchTag('VersionControlRepositoryError', (err) =>
        Effect.fail(new RepositoryError(err.message))
      )
    );

  const findDocumentById: VersionedDocumentStore['findDocumentById'] = (
    id: VersionControlId
  ) =>
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
      Effect.timeoutFail({
        duration: '5 seconds',
        onTimeout: () =>
          new NotFoundError('Timeout in getting document handle'),
      })
    );

  const updateDocumentSpans: VersionedDocumentStore['updateDocumentSpans'] = ({
    documentHandle,
    spans,
  }) =>
    Effect.try({
      try: () =>
        documentHandle.change((doc) => {
          Automerge.updateSpans(
            doc,
            ['content'],
            spans.map((span) =>
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
        }),
      catch: mapErrorTo(RepositoryError, 'Automerge repo error'),
    });

  const deleteDocument: VersionedDocumentStore['deleteDocument'] = (
    documentId
  ) =>
    pipe(
      findDocumentById(documentId),
      Effect.tap((documentHandle) =>
        Effect.try({
          try: () => documentHandle.delete(),
          catch: mapErrorTo(RepositoryError, 'Automerge repo error'),
        })
      )
    );

  const getDocumentHeads: VersionedDocumentStore['getDocumentHeads'] = (
    document
  ) =>
    Effect.try({
      try: () => getArtifactHeads<RichTextDocument>(document),
      catch: mapErrorTo(RepositoryError, 'Automerge repo error'),
    });

  const getDocumentHandleHistory: VersionedDocumentStore['getDocumentHandleHistory'] =
    (handle: VersionedDocumentHandle) =>
      Effect.tryPromise({
        try: () => getArtifactHandleHistory<RichTextDocument>(handle),
        catch: mapErrorTo(RepositoryError, 'Automerge repo error'),
      });

  const isContentSameAtHeads: VersionedDocumentStore['isContentSameAtHeads'] =
    ({ document, heads1, heads2 }) =>
      isArtifactContentSameAtHeads<RichTextDocument>(document, heads1, heads2);

  const commitChanges: VersionedDocumentStore['commitChanges'] = ({
    documentHandle,
    message,
  }) =>
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
    });

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
    updateDocumentSpans,
    getDocumentFromHandle,
    deleteDocument,
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
