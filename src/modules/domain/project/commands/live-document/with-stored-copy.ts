import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as PubSub from 'effect/PubSub';
import * as Ref from 'effect/Ref';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';

import {
  type ConvergentDocument,
  type ConvergentDocumentState,
  type RepresentationTransform,
} from '../../../../../modules/domain/rich-text';
import { type ArtifactId } from '../../../../../modules/infrastructure/version-control';
import {
  createErrorChannel,
  subscribeToRefChanges,
  type Unsubscribe,
} from '../../../../../utils/effect';
import { VersionedProjectNotFoundErrorTag } from '../../errors';
import { type ProjectId } from '../../models';
import { type ProjectStore, type ShareId } from '../../ports';
import { persistDocument } from '../persist-document';
import {
  type LiveDocument,
  type LiveDocumentError,
  type StoredLiveDocument,
} from './live-document';
import { rebasedOn, storedCopy } from './stored-copy';

export type WithStoredCopyDeps = {
  transformToText: RepresentationTransform['transformToText'];
  findDocumentById: ProjectStore['findDocumentById'];
  updateRichTextDocumentContent: ProjectStore['updateRichTextDocumentContent'];
  subscribeToProjectDirChanges: (listener: () => void) => Unsubscribe;
};

export type WithStoredCopyArgs = {
  projectId: ProjectId;
  documentId: ArtifactId;
  // What the store holds for this document.
  storedContent: string;
};

export const withStoredCopy =
  ({
    transformToText,
    findDocumentById,
    updateRichTextDocumentContent,
    subscribeToProjectDirChanges,
  }: WithStoredCopyDeps) =>
  ({ projectId, documentId, storedContent }: WithStoredCopyArgs) =>
  (
    document: LiveDocument & Pick<ConvergentDocument, 'change'>
  ): Effect.Effect<StoredLiveDocument> =>
    pipe(
      SubscriptionRef.get(document.content),
      Effect.flatMap((initialState) =>
        Effect.all({
          errorChannel: createErrorChannel<LiveDocumentError>(),
          // The content is the store's, the base the document's: opened
          // privately those agree, since the document was started from this
          // very text. Opened at a share they potentially do not.
          stored: Ref.make(
            storedCopy({ content: storedContent, base: initialState.version })
          ),
          persistSemaphore: Effect.makeSemaphore(1),
        })
      ),
      Effect.flatMap(({ errorChannel, stored, persistSemaphore }) => {
        const report = (error: LiveDocumentError) =>
          Effect.asVoid(PubSub.publish(errorChannel, error));

        // Persistence ops run strictly one after another: the next starts
        // only after the previous has fully finished.
        const persistMutex = persistSemaphore.withPermits(1);

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

        // Writes what the document holds when its turn comes: states that
        // arrive while a write is under way are written by the next one, and
        // what the disk already holds is not written again.
        const persistNow = persistMutex(
          pipe(SubscriptionRef.get(document.content), Effect.flatMap(persist))
        );

        // Everything typed so far reaches the disk: what is still on its
        // way to the document is contributed first.
        const flush = pipe(
          document.applyPendingLocalEdits,
          Effect.zipRight(persistNow)
        );

        // Re-derives the live content from the disk. Content equal to what
        // we last wrote or read is our own write coming back, so pending
        // typing has to survive it. A genuine external change is
        // contributed like any other source, and merges with that typing.
        const refresh = persistMutex(
          pipe(
            // Suspended so each refresh issues its own read.
            Effect.suspend(() => findDocumentById({ projectId, documentId })),
            Effect.flatMap(({ artifact: fresh }) =>
              pipe(
                Ref.get(stored),
                Effect.flatMap((copy) =>
                  // Content the store already holds is a write or read of
                  // our own coming back, not an edit made by another hand.
                  copy.content === fresh.content
                    ? Effect.void
                    : pipe(
                        // The disk content was derived from the state we
                        // last wrote or read, so anchor the change there.
                        // It holds the primary representation already, so
                        // it contributes as it is.
                        document.change(fresh.content, { base: copy.base }),
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
            SubscriptionRef.get(document.content),
            Effect.flatMap((current) =>
              Ref.update(stored, rebasedOn(current.version))
            )
          )
        );

        const attachTo = (shareId: ShareId) =>
          pipe(document.attachTo(shareId), Effect.zipRight(rebaseOnDocument));

        const detach = pipe(document.detach, Effect.zipRight(rebaseOnDocument));

        // Unsubscribe first, so the echo of the closing write cannot start
        // a refresh on a document that is going away.
        const close = pipe(
          Effect.sync(() => unsubscribeFromDisk()),
          Effect.zipRight(Effect.sync(() => unsubscribeFromContent())),
          // Pending typing is contributed and the file written before the
          // document closes. It closes even when that fails, and the
          // failure is raised.
          Effect.zipRight(pipe(flush, Effect.ensuring(document.close)))
        );

        // Any change under the project signals here, not just this
        // document's file. Most settle in a read and an unchanged-content
        // comparison, without reaching the editor.
        const unsubscribeFromDisk = subscribeToProjectDirChanges(() => {
          Effect.runFork(refresh);
        });

        // The disk follows the live document: any new state, from any
        // source, is written.
        const unsubscribeFromContent = subscribeToRefChanges(
          document.content,
          () => {
            Effect.runFork(pipe(persistNow, Effect.catchAll(report)));
          }
        );

        // Failures come from two places that never coordinate: writing to
        // the store, and the document itself.
        const errors = Stream.merge(
          document.errors,
          Stream.fromPubSub(errorChannel)
        );

        const kept: StoredLiveDocument = {
          documentId: document.documentId,
          content: document.content,
          edit: document.edit,
          applyPendingLocalEdits: document.applyPendingLocalEdits,
          dropPendingLocalEdits: document.dropPendingLocalEdits,
          presence: document.presence,
          attachTo,
          detach,
          flush,
          refresh,
          errors,
          close,
        };

        // A document opened at a share holds content the store has never
        // seen, and nothing more will publish it, so it is written before
        // the document is handed over. A failure leaves the document
        // usable, so it is reported rather than raised.
        return pipe(
          SubscriptionRef.get(document.content),
          Effect.flatMap((current) =>
            current.doc.content === storedContent
              ? Effect.void
              : pipe(flush, Effect.catchAll(report))
          ),
          Effect.as(kept)
        );
      })
    );
