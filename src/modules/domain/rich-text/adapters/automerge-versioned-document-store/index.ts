import { next as Automerge } from '@automerge/automerge/slim';
import { RawString, type Repo } from '@automerge/automerge-repo/slim';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import {
  getArtifactAtCommit,
  getArtifactFromHandle,
  getArtifactHandleAtCommit,
  getArtifactHandleHistory,
  getArtifactHeads,
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

export const createAdapter = (automergeRepo: Repo): VersionedDocumentStore => {
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
    title,
    content,
  }) =>
    pipe(
      Effect.try({
        try: () =>
          automergeRepo.create<RichTextDocument>({
            type: versionedArtifactTypes.RICH_TEXT_DOCUMENT,
            title,
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

  return {
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
  };
};
