import debounce from 'debounce';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as Ref from 'effect/Ref';
import * as SubscriptionRef from 'effect/SubscriptionRef';

import {
  type LiveDocument,
  type LiveDocumentChange,
  type LiveDocumentChangeOptions,
  type LiveDocumentVersion,
  type RepresentationTransform,
  type RichTextDocument,
} from '../../../../modules/domain/rich-text';
import {
  type ArtifactId,
  MigrationError,
} from '../../../../modules/infrastructure/version-control';
import { subscribeToRefChanges } from '../../../../utils/effect';
import {
  NotFoundError,
  RepositoryError,
  ValidationError,
  VersionedProjectNotFoundErrorTag,
} from '../errors';
import { type ProjectId } from '../models';
import { type ProjectStore } from '../ports';
import { persistDocument, type PersistDocumentError } from './persist-document';

export type Unsubscribe = () => void;

export type PersistError = PersistDocumentError;

export type RefreshError =
  ValidationError | RepositoryError | NotFoundError | MigrationError;

export type OpenError =
  ValidationError | RepositoryError | NotFoundError | MigrationError;

export type OpenLiveDocumentDeps = {
  createLiveDocumentAdapter: (
    initial: RichTextDocument
  ) => Effect.Effect<LiveDocument>;
  transformToText: RepresentationTransform['transformToText'];
  findDocumentById: ProjectStore['findDocumentById'];
  updateRichTextDocumentContent: ProjectStore['updateRichTextDocumentContent'];
  subscribeToProjectDirChanges: (listener: () => void) => Unsubscribe;
  onPersistError: (error: unknown) => void;
  onRefreshOnDiskChangeError: (error: unknown) => void;
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
    subscribeToProjectDirChanges,
    onPersistError,
    onRefreshOnDiskChangeError,
  }: OpenLiveDocumentDeps) =>
  ({
    projectId,
    documentId,
  }: OpenLiveDocumentArgs): Effect.Effect<OpenedLiveDocument, OpenError> =>
    pipe(
      findDocumentById({ projectId, documentId }),
      Effect.flatMap(({ artifact }) =>
        pipe(
          createLiveDocumentAdapter(artifact),
          Effect.flatMap((adapter) =>
            pipe(
              SubscriptionRef.get(adapter.content),
              Effect.flatMap((initial) =>
                Effect.all({
                  adapter: Effect.succeed(adapter),
                  lastPersisted: Ref.make({
                    content: artifact.content,
                    version: initial.version,
                  }),
                  cancelledVersion: Ref.make<LiveDocumentVersion | null>(null),
                  persistSemaphore: Effect.makeSemaphore(1),
                })
              )
            )
          )
        )
      ),
      Effect.map(
        ({ adapter, lastPersisted, cancelledVersion, persistSemaphore }) => {
          // Persistence ops run strictly one after another: the next starts
          // only after the previous — including its disk write — has fully
          // finished.
          const persistMutex = persistSemaphore.withPermits(1);

          const persistToStore = persistDocument({
            transformToText,
            updateRichTextDocumentContent,
          });

          const persist = ({ doc, version }: LiveDocumentChange) =>
            pipe(
              Ref.get(lastPersisted),
              Effect.flatMap((last) =>
                persistToStore({
                  projectId,
                  documentId,
                  document: doc,
                  skipIfContentEquals: last.content,
                })
              ),
              Effect.flatMap((textContent) =>
                Ref.set(lastPersisted, { content: textContent, version })
              )
            );

          // There is no pending buffer: the live document itself holds what
          // is pending, and `persist` skips content that is already on disk.
          // Reading the current value directly means a flush can never miss
          // a change whose subscriber delivery is still in flight.
          const flush = persistMutex(
            pipe(
              Effect.sync(() => debouncedFlush.clear()),
              Effect.zipRight(SubscriptionRef.get(adapter.content)),
              Effect.flatMap((current) =>
                pipe(
                  Ref.get(cancelledVersion),
                  Effect.flatMap((cancelled) =>
                    current.version === cancelled
                      ? Effect.void
                      : persist(current)
                  )
                )
              )
            )
          );

          const debouncedFlush = debounce(() => {
            Effect.runPromise(flush).catch(onPersistError);
          }, PERSIST_DEBOUNCE_MS);

          // Marks the content as of now as not-to-persist; any later change
          // produces a new version, which persists again.
          const cancelPendingPersist = persistMutex(
            pipe(
              Effect.sync(() => debouncedFlush.clear()),
              Effect.zipRight(SubscriptionRef.get(adapter.content)),
              Effect.flatMap((current) =>
                Ref.set(cancelledVersion, current.version)
              )
            )
          );

          // Re-derives the live content from the disk. Content equal to
          // what we last wrote or read is our own write coming back, so
          // pending typing has to survive it. A genuine external
          // change wins over pending typing.
          const refresh = persistMutex(
            pipe(
              // Suspended so each refresh issues its own read; the
              // renderer's store starts its IPC call when the effect is
              // constructed.
              Effect.suspend(() => findDocumentById({ projectId, documentId })),
              Effect.flatMap(({ artifact: fresh }) =>
                pipe(
                  Ref.get(lastPersisted),
                  Effect.flatMap((last) =>
                    last.content === fresh.content
                      ? Effect.void
                      : pipe(
                          Effect.sync(() => debouncedFlush.clear()),
                          // The disk content was derived from the state we
                          // last wrote or read, so anchor the change there.
                          Effect.zipRight(
                            adapter.change(fresh, { base: last.version })
                          ),
                          Effect.flatMap((version) =>
                            Ref.set(lastPersisted, {
                              content: fresh.content,
                              version,
                            })
                          ),
                          Effect.asVoid
                        )
                  )
                )
              )
            )
          );

          const refreshOnDiskChange = pipe(
            refresh,
            // Ignore vanishing-file errors (e.g. caused by file renames).
            Effect.catchTag(
              VersionedProjectNotFoundErrorTag,
              () => Effect.void
            ),
            // Nothing awaits this, so a failed re-read has no caller to raise to.
            Effect.catchAll((error) =>
              Effect.sync(() => onRefreshOnDiskChangeError(error))
            )
          );

          // Any change under the project signals here, not just this
          // document's file. Most settle in a read and an unchanged-content
          // comparison, without reaching the editor.
          const unsubscribeFromDisk = subscribeToProjectDirChanges(() => {
            Effect.runPromise(refreshOnDiskChange).catch(
              onRefreshOnDiskChangeError
            );
          });

          // The disk follows the live document: any new state, from any
          // source, arms a write.
          const unsubscribeFromContent = subscribeToRefChanges(
            adapter.content,
            () => debouncedFlush()
          );

          const change = (
            doc: RichTextDocument,
            options?: LiveDocumentChangeOptions
          ) => adapter.change(doc, options);

          // Unsubscribe first, so the echo of the closing flush cannot
          // start a refresh on a document that is going away.
          const close = pipe(
            Effect.sync(unsubscribeFromDisk),
            Effect.zipRight(Effect.sync(unsubscribeFromContent)),
            Effect.zipRight(flush)
          );

          return {
            content: adapter.content,
            change,
            flush,
            refresh,
            cancelPendingPersist,
            close,
          };
        }
      )
    );
