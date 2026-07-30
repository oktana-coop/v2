import debounce from 'debounce';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as Ref from 'effect/Ref';

import {
  type LiveDocument,
  type RepresentationTransform,
  type RichTextDocument,
} from '../../../../modules/domain/rich-text';
import {
  type ArtifactId,
  MigrationError,
} from '../../../../modules/infrastructure/version-control';
import { NotFoundError, RepositoryError, ValidationError } from '../errors';
import { type ProjectId } from '../models';
import { type ProjectStore } from '../ports';
import { persistDocument, type PersistDocumentError } from './persist-document';

export type PersistError = PersistDocumentError;

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
  findDocumentById: ProjectStore['findDocumentById'];
  updateRichTextDocumentContent: ProjectStore['updateRichTextDocumentContent'];
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
    findDocumentById,
    updateRichTextDocumentContent,
    onPersistError,
  }: OpenLiveDocumentDeps) =>
  ({
    projectId,
    documentId,
  }: OpenLiveDocumentArgs): Effect.Effect<OpenedLiveDocument, OpenError> =>
    pipe(
      findDocumentById({ projectId, documentId }),
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
              // Persistence ops run strictly one after another: the next starts
              // only after the previous — including its disk write — has fully
              // finished.
              const persistMutex = persistSemaphore.withPermits(1);

              const persistToStore = persistDocument({
                transformToText,
                updateRichTextDocumentContent,
              });

              const persist = (doc: RichTextDocument) =>
                pipe(
                  Ref.get(lastPersisted),
                  Effect.flatMap((last) =>
                    persistToStore({
                      projectId,
                      documentId,
                      document: doc,
                      skipIfContentEquals: last,
                    })
                  ),
                  Effect.flatMap((textContent) =>
                    Ref.set(lastPersisted, textContent)
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

              // TODO: Interim mechanism — to be replaced by filesystem watching,
              // which will drive this re-derivation without manual call sites.
              // It is assumed the caller has settled pending content (flush or cancel)
              // and that the disk now holds what the live document should show.
              const refresh = persistMutex(
                pipe(
                  // Takes pending content to essentially discard it.
                  takePendingPersist,
                  // Suspended so each refresh issues its own read; the renderer's
                  // store starts its IPC call when the effect is constructed.
                  Effect.zipRight(
                    Effect.suspend(() =>
                      findDocumentById({ projectId, documentId })
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
                              // Update the live document.
                              Effect.zipRight(adapter.change(fresh)),
                              Effect.asVoid
                            )
                      )
                    )
                  )
                )
              );

              const change = (doc: RichTextDocument) =>
                pipe(
                  // Update the live document.
                  adapter.change(doc),
                  // Flush to disk (with a debounce).
                  Effect.tap(() => Ref.set(pendingPersist, doc)),
                  Effect.tap(() => Effect.sync(() => debouncedFlush()))
                );

              return {
                content: adapter.content,
                change,
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
