import debounce from 'debounce';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as PubSub from 'effect/PubSub';
import * as Ref from 'effect/Ref';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';

import {
  type ConvergentDocument,
  type ConvergentDocumentChangeOptions,
  type ConvergentDocumentState,
  type ConvergentDocumentVersion,
  type RepresentationTransform,
  type RichTextDocument,
  toPrimaryTextRepresentation,
} from '../../../../../modules/domain/rich-text';
import { type ArtifactId } from '../../../../../modules/infrastructure/version-control';
import {
  createErrorChannel,
  subscribeToRefChanges,
  type Unsubscribe,
} from '../../../../../utils/effect';
import { VersionedProjectNotFoundErrorTag } from '../../errors';
import { type ProjectId } from '../../models';
import {
  type DocumentSharing,
  type ProjectStore,
  type ShareUrl,
} from '../../ports';
import { persistDocument } from '../persist-document';
import { type LiveDocument, type LiveDocumentError } from './live-document';
import { rebasedOn, storedCopy } from './stored-copy';
import { createSwitchableDocument } from './switchable-convergent-document';

export type CreateLiveDocumentDeps = {
  // Starts a document nobody else can reach, from the given text. Nothing
  // about it can fail: there is no link to reach and no format to read.
  createPrivateDocument: (
    initialText: string
  ) => Effect.Effect<ConvergentDocument>;
  openSharedDocument: DocumentSharing['openSharedDocument'];
  transformToText: RepresentationTransform['transformToText'];
  findDocumentById: ProjectStore['findDocumentById'];
  updateRichTextDocumentContent: ProjectStore['updateRichTextDocumentContent'];
  subscribeToProjectDirChanges: (listener: () => void) => Unsubscribe;
};

export type CreateLiveDocumentArgs = {
  projectId: ProjectId;
  documentId: ArtifactId;
  // What the store holds for this document.
  storedContent: string;
  // The document to run on first, which may hold something else entirely: a
  // share holds what its peers have, not what this disk has. Sharing,
  // joining and leaving replace it.
  initialDocument: ConvergentDocument;
};

const PERSIST_DEBOUNCE_MS = 300;

export const createLiveDocument =
  ({
    createPrivateDocument,
    openSharedDocument,
    transformToText,
    findDocumentById,
    updateRichTextDocumentContent,
    subscribeToProjectDirChanges,
  }: CreateLiveDocumentDeps) =>
  ({
    projectId,
    documentId,
    storedContent,
    initialDocument,
  }: CreateLiveDocumentArgs): Effect.Effect<LiveDocument> =>
    pipe(
      createErrorChannel<LiveDocumentError>(),
      Effect.flatMap((errorChannel) => {
        const report = (error: LiveDocumentError) =>
          Effect.asVoid(PubSub.publish(errorChannel, error));

        return pipe(
          createSwitchableDocument({ initial: initialDocument }),
          Effect.flatMap((convergentDocument) =>
            pipe(
              SubscriptionRef.get(convergentDocument.content),
              Effect.flatMap((initialState) =>
                Effect.all({
                  convergentDocument: Effect.succeed(convergentDocument),
                  // The content is the store's, the base the document's: opened
                  // privately those agree, since the document was started from
                  // this very text. Opened at a share they potentially do not.
                  stored: Ref.make(
                    storedCopy({
                      content: storedContent,
                      base: initialState.version,
                    })
                  ),
                  // The version, if any, that must not reach the store.
                  cancelledVersion: Ref.make<ConvergentDocumentVersion | null>(
                    null
                  ),
                  persistSemaphore: Effect.makeSemaphore(1),
                })
              )
            )
          ),
          Effect.map(
            ({
              convergentDocument,
              stored,
              cancelledVersion,
              persistSemaphore,
            }) => {
              // Persistence ops run strictly one after another: the next starts
              // only after the previous has fully finished.
              const persistMutex = persistSemaphore.withPermits(1);

              const toPrimaryRepresentation = toPrimaryTextRepresentation({
                transformToText,
              });

              const persistToStore = persistDocument({
                transformToText,
                updateRichTextDocumentContent,
              });

              const persist = ({ doc, version }: ConvergentDocumentState) =>
                pipe(
                  Ref.get(stored),
                  Effect.flatMap((copy) =>
                    persistToStore({
                      projectId,
                      documentId,
                      document: doc,
                      skipIfContentEquals: copy.content,
                    })
                  ),
                  Effect.flatMap((textContent) =>
                    Ref.set(
                      stored,
                      storedCopy({ content: textContent, base: version })
                    )
                  )
                );

              const flush = persistMutex(
                pipe(
                  Effect.sync(() => debouncedFlush.clear()),
                  Effect.zipRight(
                    SubscriptionRef.get(convergentDocument.content)
                  ),
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
                Effect.runFork(pipe(flush, Effect.catchAll(report)));
              }, PERSIST_DEBOUNCE_MS);

              // Refuses the version the document holds right now, so an armed
              // write cannot put back what the caller is discarding. Anything
              // typed afterwards has a version of its own, and is written as
              // usual.
              const cancelPendingPersist = persistMutex(
                pipe(
                  Effect.sync(() => debouncedFlush.clear()),
                  Effect.zipRight(
                    SubscriptionRef.get(convergentDocument.content)
                  ),
                  Effect.flatMap((current) =>
                    Ref.set(cancelledVersion, current.version)
                  )
                )
              );

              // Re-derives the live content from the disk. Content equal to what
              // we last wrote or read is our own write coming back, so pending
              // typing has to survive it. A genuine external change is
              // contributed like any other source, and merges with that typing.
              const refresh = persistMutex(
                pipe(
                  // Suspended so each refresh issues its own read.
                  Effect.suspend(() =>
                    findDocumentById({ projectId, documentId })
                  ),
                  Effect.flatMap(({ artifact: fresh }) =>
                    pipe(
                      Ref.get(stored),
                      Effect.flatMap((copy) =>
                        // Content the store already holds is a write or read of
                        // our own coming back, not an edit made by another hand.
                        copy.content === fresh.content
                          ? Effect.void
                          : pipe(
                              Effect.sync(() => debouncedFlush.clear()),
                              // The disk content was derived from the state we
                              // last wrote or read, so anchor the change there.
                              Effect.zipRight(
                                // The disk holds the primary representation
                                // already, so it contributes as it is.
                                convergentDocument.change(fresh.content, {
                                  base: copy.base,
                                })
                              ),
                              Effect.flatMap((version) =>
                                Ref.set(
                                  stored,
                                  storedCopy({
                                    content: fresh.content,
                                    base: version,
                                  })
                                )
                              ),
                              Effect.asVoid
                            )
                      )
                    )
                  ),
                  // A document that is gone (e.g. renamed) leaves nothing to pick
                  // up, which is not a failure.
                  Effect.catchTag(
                    VersionedProjectNotFoundErrorTag,
                    () => Effect.void
                  ),
                  // Picking up an outside edit is best-effort: nothing awaits
                  // this, so a failed re-read has no caller to raise to.
                  Effect.catchAll(report)
                )
              );

              const rebaseOnDocument = persistMutex(
                pipe(
                  SubscriptionRef.get(convergentDocument.content),
                  Effect.flatMap((current) =>
                    pipe(
                      Ref.update(stored, rebasedOn(current.version)),
                      Effect.zipRight(Ref.set(cancelledVersion, null))
                    )
                  )
                )
              );

              // Runs on another document from here on. What the disk holds now
              // derives from the new document's state, so the stored copy is
              // rebased on it: nothing said about the old one applies.
              const switchTo = <E>(
                open: Effect.Effect<ConvergentDocument, E>
              ) =>
                pipe(
                  open,
                  Effect.flatMap(convergentDocument.switchTo),
                  Effect.zipRight(rebaseOnDocument)
                );

              const currentText = pipe(
                SubscriptionRef.get(convergentDocument.content),
                Effect.map((current) => current.doc.content)
              );

              // Contributions come in whatever representation their source
              // holds; the document takes the primary text one. Only the newest
              // of a burst is applied: an older conversion finishing later would
              // otherwise be written over newer text.
              let latestContribution = 0;

              const currentVersion = pipe(
                SubscriptionRef.get(convergentDocument.content),
                Effect.map((current) => current.version)
              );

              const change = (
                doc: RichTextDocument,
                options?: ConvergentDocumentChangeOptions
              ) => {
                const contribution = (latestContribution += 1);

                return pipe(
                  toPrimaryRepresentation(doc),
                  Effect.flatMap((text) =>
                    contribution === latestContribution
                      ? convergentDocument.change(text, options)
                      : currentVersion
                  ),
                  // Contributing has no error channel: a failed conversion is
                  // reported and leaves the document as it was.
                  Effect.catchAll((error) =>
                    pipe(report(error), Effect.zipRight(currentVersion))
                  )
                );
              };

              const attachTo = (shareUrl: ShareUrl) =>
                switchTo(openSharedDocument({ shareUrl }));

              // The content goes with it: leaving a share keeps what the share
              // left the document holding.
              const detach = switchTo(
                pipe(currentText, Effect.flatMap(createPrivateDocument))
              );

              // Unsubscribe first, so the echo of the closing flush cannot start
              // a refresh on a document that is going away.
              const close = pipe(
                Effect.sync(() => unsubscribeFromDisk()),
                Effect.zipRight(Effect.sync(() => unsubscribeFromContent())),
                // A document on its way out leaves nobody to act on the failure,
                // so the closing write is reported rather than raised.
                Effect.zipRight(pipe(flush, Effect.catchAll(report))),
                Effect.zipRight(convergentDocument.close)
              );

              // Any change under the project signals here, not just this
              // document's file. Most settle in a read and an unchanged-content
              // comparison, without reaching the editor.
              const unsubscribeFromDisk = subscribeToProjectDirChanges(() => {
                Effect.runFork(refresh);
              });

              // The disk follows the live document: any new state, from any
              // source, arms a write.
              const unsubscribeFromContent = subscribeToRefChanges(
                convergentDocument.content,
                () => debouncedFlush()
              );

              // Failures come from two places that never coordinate: writing to
              // the store, and the convergent document.
              const errors = Stream.merge(
                Stream.fromPubSub(errorChannel),
                convergentDocument.errors
              );

              return {
                documentId,
                content: convergentDocument.content,
                change,
                presence: convergentDocument.presence,
                attachTo,
                detach,
                flush,
                refresh,
                cancelPendingPersist,
                errors,
                close,
              };
            }
          ),
          // A document opened at a share holds content the store has never seen,
          // and nothing more will publish it, so it is written before the
          // document is handed over. A failure leaves the document usable, so it
          // is reported rather than raised.
          Effect.tap((liveDocument) =>
            pipe(
              SubscriptionRef.get(liveDocument.content),
              Effect.flatMap((current) =>
                current.doc.content === storedContent
                  ? Effect.void
                  : pipe(liveDocument.flush, Effect.catchAll(report))
              )
            )
          )
        );
      })
    );
