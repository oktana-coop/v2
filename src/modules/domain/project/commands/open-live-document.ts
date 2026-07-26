import debounce from 'debounce';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as Ref from 'effect/Ref';

import {
  type LiveDocument,
  PRIMARY_RICH_TEXT_REPRESENTATION,
  type RepresentationTransform,
  RepresentationTransformError,
  type RichTextDocument,
} from '../../../../modules/domain/rich-text';
import {
  type ArtifactId,
  MigrationError,
} from '../../../../modules/infrastructure/version-control';
import { mapErrorTo } from '../../../../utils/errors';
import { NotFoundError, RepositoryError, ValidationError } from '../errors';
import { type ProjectId } from '../models';
import { type ProjectStore } from '../ports';

export type PersistError =
  | ValidationError
  | RepositoryError
  | NotFoundError
  | MigrationError
  | RepresentationTransformError;

export type RefreshError =
  | ValidationError
  | RepositoryError
  | NotFoundError
  | MigrationError;

export type OpenError =
  | ValidationError
  | RepositoryError
  | NotFoundError
  | MigrationError;

export type OpenLiveDocumentDeps = {
  createLiveDocumentAdapter: (
    initial: RichTextDocument
  ) => Effect.Effect<LiveDocument>;
  transformToText: RepresentationTransform['transformToText'];
  projectStore: ProjectStore;
  onPersistError: (error: unknown) => void;
};

export type OpenLiveDocumentArgs = {
  projectId: ProjectId;
  documentId: ArtifactId;
};

export type OpenedLiveDocument = LiveDocument & {
  flush: Effect.Effect<void, PersistError>;
  refresh: Effect.Effect<void, RefreshError>;
  cancelPendingPersist: Effect.Effect<void>;
  close: Effect.Effect<void, PersistError>;
};

const PERSIST_DEBOUNCE_MS = 300;

export const openLiveDocument =
  ({
    createLiveDocumentAdapter,
    transformToText,
    projectStore,
    onPersistError,
  }: OpenLiveDocumentDeps) =>
  ({
    projectId,
    documentId,
  }: OpenLiveDocumentArgs): Effect.Effect<OpenedLiveDocument, OpenError> =>
    pipe(
      projectStore.findDocumentById({ projectId, documentId }),
      Effect.flatMap(({ artifact }) =>
        pipe(
          Effect.all({
            adapter: createLiveDocumentAdapter(artifact),
            lastPersisted: Ref.make(artifact.content),
            pendingPersist: Ref.make<RichTextDocument | null>(null),
            persistSemaphore: Effect.makeSemaphore(1),
          }),
          Effect.map(
            ({ adapter, lastPersisted, pendingPersist, persistSemaphore }) => {
              // At most one persistence-affecting operation in flight.
              // One resolving means no write is still landing.
              const persistMutex = persistSemaphore.withPermits(1);

              const toPrimaryTextRepresentation = (doc: RichTextDocument) =>
                doc.representation === PRIMARY_RICH_TEXT_REPRESENTATION
                  ? Effect.succeed(doc.content)
                  : Effect.tryPromise({
                      try: () =>
                        transformToText({
                          from: doc.representation,
                          to: PRIMARY_RICH_TEXT_REPRESENTATION,
                          input: doc.content,
                        }),
                      catch: mapErrorTo(
                        RepresentationTransformError,
                        'Rich text representation transformation error'
                      ),
                    });

              const persist = (doc: RichTextDocument) =>
                pipe(
                  toPrimaryTextRepresentation(doc),
                  Effect.flatMap((textContent) =>
                    pipe(
                      Ref.get(lastPersisted),
                      Effect.flatMap((last) =>
                        last === textContent
                          ? Effect.void
                          : pipe(
                              projectStore.updateRichTextDocumentContent({
                                projectId,
                                documentId,
                                representation:
                                  PRIMARY_RICH_TEXT_REPRESENTATION,
                                content: textContent,
                              }),
                              Effect.zipRight(
                                Ref.set(lastPersisted, textContent)
                              )
                            )
                      )
                    )
                  )
                );

              // Unlocked - callers wrap it in the persist mutex.
              const takePendingPersist = pipe(
                Effect.sync(() => debouncedFlush.clear()),
                Effect.zipRight(Ref.getAndSet(pendingPersist, null))
              );

              const flush = persistMutex(
                pipe(
                  takePendingPersist,
                  Effect.flatMap((doc) =>
                    doc === null ? Effect.void : persist(doc)
                  )
                )
              );

              const debouncedFlush = debounce(() => {
                Effect.runPromise(flush).catch(onPersistError);
              }, PERSIST_DEBOUNCE_MS);

              const cancelPendingPersist = persistMutex(
                Effect.asVoid(takePendingPersist)
              );

              const refresh = persistMutex(
                pipe(
                  takePendingPersist,
                  // Suspended so each refresh issues its own read; the renderer's
                  // store starts its IPC call when the effect is constructed.
                  Effect.zipRight(
                    Effect.suspend(() =>
                      projectStore.findDocumentById({ projectId, documentId })
                    )
                  ),
                  Effect.flatMap(({ artifact: fresh }) =>
                    pipe(
                      Ref.get(lastPersisted),
                      Effect.flatMap((last) =>
                        last === fresh.content
                          ? Effect.void
                          : pipe(
                              Ref.set(lastPersisted, fresh.content),
                              Effect.zipRight(adapter.change(fresh)),
                              Effect.asVoid
                            )
                      )
                    )
                  )
                )
              );

              return {
                content: adapter.content,
                change: (doc: RichTextDocument) =>
                  pipe(
                    adapter.change(doc),
                    Effect.tap(() => Ref.set(pendingPersist, doc)),
                    Effect.tap(() => Effect.sync(() => debouncedFlush()))
                  ),
                flush,
                refresh,
                cancelPendingPersist,
                close: flush,
              };
            }
          )
        )
      )
    );
