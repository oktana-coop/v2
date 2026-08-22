import debounce from 'debounce';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as Ref from 'effect/Ref';
import * as SubscriptionRef from 'effect/SubscriptionRef';

import {
  type ConvergentDocument,
  type ConvergentDocumentChangeOptions,
  type ConvergentDocumentState,
  type RepresentationTransform,
  type RichTextDocument,
  toPrimaryTextRepresentation,
} from '../../../../../modules/domain/rich-text';
import {
  type ArtifactId,
  MigrationError,
} from '../../../../../modules/infrastructure/version-control';
import {
  subscribeToRefChanges,
  type Unsubscribe,
} from '../../../../../utils/effect';
import {
  NotFoundError,
  RepositoryError,
  ValidationError,
  VersionedProjectNotFoundErrorTag,
} from '../../errors';
import { type ProjectId } from '../../models';
import { type ProjectStore } from '../../ports';
import { type LiveDocument } from '../live-document';
import { persistDocument } from '../persist-document';
import {
  holdsContent,
  mayWrite,
  nowHolding,
  rebasedOn,
  storedCopy,
  writeCancelled,
} from './stored-copy';

export type OpenError =
  ValidationError | RepositoryError | NotFoundError | MigrationError;

export type OpenLiveDocumentDeps = {
  // Takes what the store holds, for a document that has to be started from
  // it rather than found somewhere.
  createConvergentDocument: (
    initialText: string
  ) => Effect.Effect<ConvergentDocument>;
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
    createConvergentDocument,
    transformToText,
    findDocumentById,
    updateRichTextDocumentContent,
    subscribeToProjectDirChanges,
    onPersistError,
  }: OpenLiveDocumentDeps) =>
  ({
    projectId,
    documentId,
  }: OpenLiveDocumentArgs): Effect.Effect<LiveDocument, OpenError> =>
    pipe(
      findDocumentById({ projectId, documentId }),
      Effect.flatMap(({ artifact }) =>
        pipe(
          createConvergentDocument(artifact.content),
          Effect.flatMap((convergentDocument) =>
            pipe(
              SubscriptionRef.get(convergentDocument.content),
              Effect.flatMap((initial) =>
                Effect.all({
                  convergentDocument: Effect.succeed(convergentDocument),
                  initial: Effect.succeed(initial),
                  storedContent: Effect.succeed(artifact.content),
                  stored: Ref.make(
                    storedCopy({
                      content: artifact.content,
                      version: initial.version,
                    })
                  ),
                  persistSemaphore: Effect.makeSemaphore(1),
                })
              )
            )
          )
        )
      ),
      Effect.map(
        ({
          convergentDocument,
          initial,
          storedContent,
          stored,
          persistSemaphore,
        }) => {
          // Persistence ops run strictly one after another: the next starts
          // only after the previous — including its disk write — has fully
          // finished. The document needs no such ordering of its own: its
          // merges commute.
          const persistMutex = persistSemaphore.withPermits(1);

          const toText = toPrimaryTextRepresentation({ transformToText });

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
                Ref.update(stored, (copy) =>
                  nowHolding({ stored: copy, content: textContent, version })
                )
              )
            );

          // There is no pending buffer: the convergent document itself
          // holds what is pending, and `persist` skips content that is
          // already on disk. Reading the current value directly means a
          // flush can never miss a change whose subscriber delivery is
          // still in flight.
          const flush = persistMutex(
            pipe(
              Effect.sync(() => debouncedFlush.clear()),
              Effect.zipRight(SubscriptionRef.get(convergentDocument.content)),
              Effect.flatMap((current) =>
                pipe(
                  Ref.get(stored),
                  Effect.flatMap((copy) =>
                    mayWrite({ stored: copy, version: current.version })
                      ? persist(current)
                      : Effect.void
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
              Effect.zipRight(SubscriptionRef.get(convergentDocument.content)),
              Effect.flatMap((current) =>
                Ref.update(stored, (copy) =>
                  writeCancelled({ stored: copy, version: current.version })
                )
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
                      Ref.get(stored),
                      Effect.flatMap((copy) =>
                        holdsContent({ stored: copy, content: fresh.content })
                          ? Effect.void
                          : pipe(
                              Effect.sync(() => debouncedFlush.clear()),
                              // The disk content was derived from the state
                              // we last wrote or read, so anchor the change
                              // there.
                              Effect.zipRight(
                                // The disk holds the primary representation
                                // already, so it contributes as it is.
                                convergentDocument.change(fresh.content, {
                                  base: copy.version,
                                })
                              ),
                              Effect.flatMap((version) =>
                                Ref.update(stored, (previous) =>
                                  nowHolding({
                                    stored: previous,
                                    content: fresh.content,
                                    version,
                                  })
                                )
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

          // The disk follows the convergent document: any new state, from any
          // source, arms a write.
          const unsubscribeFromContent = subscribeToRefChanges(
            convergentDocument.content,
            () => debouncedFlush()
          );

          // A document opened at a share holds content the disk has never
          // seen, and nothing more will publish it: arm the write here.
          if (initial.doc.content !== storedContent) debouncedFlush();

          const rebaseOnDocument = persistMutex(
            pipe(
              SubscriptionRef.get(convergentDocument.content),
              Effect.flatMap((current) =>
                Ref.update(stored, (copy) =>
                  rebasedOn({ stored: copy, version: current.version })
                )
              )
            )
          );

          // Contributions come in whatever representation their source
          // holds; the document takes the primary text one. Only the newest
          // of a burst is applied: an older conversion finishing later would
          // otherwise be written over newer text.
          let latestContribution = 0;

          const change = (
            doc: RichTextDocument,
            options?: ConvergentDocumentChangeOptions
          ) => {
            const contribution = (latestContribution += 1);

            return pipe(
              toText(doc),
              Effect.flatMap((text) =>
                contribution === latestContribution
                  ? convergentDocument.change(text, options)
                  : pipe(
                      SubscriptionRef.get(convergentDocument.content),
                      Effect.map((current) => current.version)
                    )
              ),
              // Contributing has no error channel: a failed conversion is
              // reported and leaves the document as it was.
              Effect.catchAll((error) =>
                pipe(
                  Effect.sync(() => onPersistError(error)),
                  Effect.zipRight(
                    SubscriptionRef.get(convergentDocument.content)
                  ),
                  Effect.map((current) => current.version)
                )
              )
            );
          };

          // Unsubscribe first, so the echo of the closing flush cannot start
          // a refresh on a document that is going away.
          const close = pipe(
            Effect.sync(unsubscribeFromDisk),
            Effect.zipRight(Effect.sync(unsubscribeFromContent)),
            Effect.zipRight(flush),
            Effect.zipRight(convergentDocument.close)
          );

          return {
            content: convergentDocument.content,
            change,
            attachTo: (address) =>
              pipe(
                convergentDocument.attachTo(address),
                Effect.zipRight(rebaseOnDocument)
              ),
            detach: pipe(
              convergentDocument.detach,
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
