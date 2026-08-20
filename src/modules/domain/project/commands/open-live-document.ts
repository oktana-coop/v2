import debounce from 'debounce';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as Ref from 'effect/Ref';
import * as SubscriptionRef from 'effect/SubscriptionRef';

import {
  type LiveDocument,
  type LiveDocumentChange,
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
import { persistDocument } from './persist-document';

export type Unsubscribe = () => void;

export type OpenError =
  ValidationError | RepositoryError | NotFoundError | MigrationError;

// The live document as the app uses it: the document itself plus the disk it
// is written to and followed from.
export type OpenLiveDocumentResult = LiveDocument & {
  flush: Effect.Effect<void>;
  refresh: Effect.Effect<void>;
  cancelPendingPersist: Effect.Effect<void>;
};

export type OpenLiveDocumentDeps = {
  // Takes what the store holds, for a document that has to be started from
  // it rather than found somewhere.
  createLiveDocumentAdapter: (
    initialText: string
  ) => Effect.Effect<LiveDocument>;
  transformToText: RepresentationTransform['transformToText'];
  findDocumentById: ProjectStore['findDocumentById'];
  updateRichTextDocumentContent: ProjectStore['updateRichTextDocumentContent'];
  subscribeToProjectDirChanges: (listener: () => void) => Unsubscribe;
  onPersistError: (error: unknown) => void;
};

export type OpenLiveDocumentArgs = {
  projectId: ProjectId;
  documentId: ArtifactId;
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
  }: OpenLiveDocumentDeps) =>
  ({
    projectId,
    documentId,
  }: OpenLiveDocumentArgs): Effect.Effect<OpenLiveDocumentResult, OpenError> =>
    pipe(
      findDocumentById({ projectId, documentId }),
      Effect.flatMap(({ artifact }) =>
        pipe(
          createLiveDocumentAdapter(artifact.content),
          Effect.flatMap((liveDocument) =>
            pipe(
              SubscriptionRef.get(liveDocument.content),
              Effect.flatMap((initial) =>
                Effect.all({
                  liveDocument: Effect.succeed(liveDocument),
                  initial: Effect.succeed(initial),
                  storedContent: Effect.succeed(artifact.content),
                  // What the disk holds, as far as we know, and the version
                  // that content was derived from. A document opened at a
                  // share holds something the disk has never seen, which the
                  // first write then carries to it.
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
        ({
          liveDocument,
          initial,
          storedContent,
          lastPersisted,
          cancelledVersion,
          persistSemaphore,
        }) => {
          // Persistence ops run strictly one after another: the next starts
          // only after the previous — including its disk write — has fully
          // finished. The document needs no such ordering of its own: its
          // merges commute.
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
              Effect.zipRight(SubscriptionRef.get(liveDocument.content)),
              Effect.flatMap((current) =>
                pipe(
                  Ref.get(cancelledVersion),
                  Effect.flatMap((cancelled) =>
                    current.version === cancelled
                      ? Effect.void
                      : persist(current)
                  )
                )
              ),
              // Nothing awaits an armed write, so a failed one has no caller
              // to raise to.
              Effect.catchAll((error) =>
                Effect.sync(() => onPersistError(error))
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
              Effect.zipRight(SubscriptionRef.get(liveDocument.content)),
              Effect.flatMap((current) =>
                Ref.set(cancelledVersion, current.version)
              )
            )
          );

          // Suspended so each refresh issues its own read; the renderer's
          // store starts its IPC call when the effect is constructed. A
          // document that is gone (e.g. renamed) leaves nothing to pick up,
          // which is not a failure.
          const readDocument = pipe(
            Effect.suspend(() => findDocumentById({ projectId, documentId })),
            Effect.map(({ artifact: fresh }): RichTextDocument | null => fresh),
            Effect.catchTag(VersionedProjectNotFoundErrorTag, () =>
              Effect.succeed(null)
            )
          );

          // Re-derives the live content from the disk. Content equal to what
          // we last wrote or read is our own write coming back, so pending
          // typing has to survive it. A genuine external change is
          // contributed like any other source, and merges with that typing.
          const refresh = persistMutex(
            pipe(
              readDocument,
              Effect.flatMap((fresh) =>
                fresh === null
                  ? Effect.void
                  : pipe(
                      Ref.get(lastPersisted),
                      Effect.flatMap((last) =>
                        last.content === fresh.content
                          ? Effect.void
                          : pipe(
                              Effect.sync(() => debouncedFlush.clear()),
                              // The disk content was derived from the state
                              // we last wrote or read, so anchor the change
                              // there.
                              Effect.zipRight(
                                liveDocument.change(fresh, {
                                  base: last.version,
                                })
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
              ),
              // Picking up an outside edit is best-effort: nothing awaits
              // this, so a failed re-read has no caller to raise to.
              Effect.catchAll((error) =>
                Effect.sync(() => onPersistError(error))
              )
            )
          );

          // Any change under the project signals here, not just this
          // document's file. Most settle in a read and an unchanged-content
          // comparison, without reaching the editor.
          const unsubscribeFromDisk = subscribeToProjectDirChanges(() => {
            Effect.runPromise(refresh).catch(onPersistError);
          });

          // The disk follows the live document: any new state, from any
          // source, arms a write.
          const unsubscribeFromContent = subscribeToRefChanges(
            liveDocument.content,
            () => debouncedFlush()
          );

          // A document opened at a share holds content the disk has never
          // seen, and nothing more will publish it: arm the write here.
          if (initial.doc.content !== storedContent) debouncedFlush();

          // The document keeps its content across a switch, but not its
          // versions: what the disk holds now derives from the new
          // document's state, and nothing said about the old one applies.
          const rebaseOnDocument = persistMutex(
            pipe(
              SubscriptionRef.get(liveDocument.content),
              Effect.flatMap((current) =>
                pipe(
                  Ref.update(lastPersisted, (last) => ({
                    content: last.content,
                    version: current.version,
                  })),
                  Effect.zipRight(Ref.set(cancelledVersion, null))
                )
              )
            )
          );

          // Unsubscribe first, so the echo of the closing flush cannot start
          // a refresh on a document that is going away.
          const close = pipe(
            Effect.sync(unsubscribeFromDisk),
            Effect.zipRight(Effect.sync(unsubscribeFromContent)),
            Effect.zipRight(flush),
            Effect.zipRight(liveDocument.close)
          );

          return {
            content: liveDocument.content,
            change: liveDocument.change,
            attachTo: (address) =>
              pipe(
                liveDocument.attachTo(address),
                Effect.zipRight(rebaseOnDocument)
              ),
            detach: pipe(
              liveDocument.detach,
              Effect.zipRight(rebaseOnDocument)
            ),
            flush,
            refresh,
            cancelPendingPersist,
            close,
          };
        }
      )
    );
