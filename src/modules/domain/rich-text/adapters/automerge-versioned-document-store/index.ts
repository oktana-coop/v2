import { type Doc, next as Automerge } from '@automerge/automerge/slim';
import {
  type DocHandle,
  RawString,
  type Repo,
} from '@automerge/automerge-repo/slim';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import {
  type VersionControlId,
  versionedArtifactTypes,
} from '../../../../../modules/infrastructure/version-control';
import { fromNullable } from '../../../../../utils/effect';
import { mapErrorTo } from '../../../../../utils/errors';
import { NotFoundError, RepositoryError } from '../../errors';
import {
  type RichTextDocument,
  type VersionedDocument,
  type VersionedDocumentHandle,
} from '../../models';
import { VersionedDocumentStore } from '../../ports/versioned-document-store';

export const createAdapter = (automergeRepo: Repo): VersionedDocumentStore => {
  const getDocFromHandle: <T>(
    handle: DocHandle<T>
  ) => Effect.Effect<Doc<T>, RepositoryError | NotFoundError, never> = (
    handle
  ) =>
    pipe(
      Effect.tryPromise({
        try: async () => await handle.doc(),
        catch: mapErrorTo(RepositoryError, 'Automerge repo error'),
      }),
      Effect.flatMap((doc) =>
        fromNullable(doc, () => new NotFoundError('Doc not found in handle'))
      )
    );

  const getDocumentFromHandle: (
    handle: VersionedDocumentHandle
  ) => Effect.Effect<
    VersionedDocument,
    RepositoryError | NotFoundError,
    never
  > = getDocFromHandle<RichTextDocument>;

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
      Effect.try({
        try: () => documentHandle.view(heads),
        catch: mapErrorTo(RepositoryError, 'Automerge repo error'),
      });

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

  return {
    createDocument,
    getDocumentHandleAtCommit,
    findDocumentById,
    updateDocumentSpans,
    getDocumentFromHandle,
    deleteDocument,
  };
};
