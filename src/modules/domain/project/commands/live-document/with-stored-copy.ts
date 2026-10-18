import * as Effect from 'effect/Effect';
import * as Fiber from 'effect/Fiber';
import { pipe } from 'effect/Function';
import * as PubSub from 'effect/PubSub';
import * as Ref from 'effect/Ref';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';

import { type ArtifactId } from '../../../../../modules/infrastructure/version-control';
import {
  createErrorChannel,
  subscribeToRefChanges,
} from '../../../../../utils/effect';
import {
  type ConvergentDocumentState,
  type EditableLiveDocument,
  type LocalEditsContributionError,
  type ShareId,
} from '../../../collaboration';
import {
  VersionedProjectDocumentNotOnCurrentRefErrorTag,
  VersionedProjectNotFoundErrorTag,
} from '../../errors';
import { type ProjectId } from '../../models';
import { type ProjectStore } from '../../ports';
import { rebasedOn, storedCopy } from './stored-copy';
import {
  type StoredContentReadError,
  type StoredCopyWriteError,
  type StoredLiveDocument,
} from './stored-live-document';

export type StoredContent<DocumentType> = {
  read: (args: {
    projectId: ProjectId;
    documentId: ArtifactId;
  }) => Effect.Effect<DocumentType, StoredContentReadError>;
  write: (args: {
    projectId: ProjectId;
    documentId: ArtifactId;
    document: DocumentType;
  }) => Effect.Effect<void, StoredCopyWriteError>;
  areEqual: (a: DocumentType, b: DocumentType) => boolean;
};

export type WithStoredCopyDeps<DocumentType> = {
  storedContent: StoredContent<DocumentType>;
  projectContentChangeEvents: ProjectStore['projectContentChangeEvents'];
};

export type WithStoredCopyArgs<DocumentType> = {
  projectId: ProjectId;
  documentId: ArtifactId;
  // What the store holds for this document.
  initial: DocumentType;
};

export const withStoredCopy =
  <DocumentType>({
    storedContent: { read, write, areEqual },
    projectContentChangeEvents,
  }: WithStoredCopyDeps<DocumentType>) =>
  ({ projectId, documentId, initial }: WithStoredCopyArgs<DocumentType>) =>
  <ParticipantSelectionType, EditorDocumentType = DocumentType>(
    document: EditableLiveDocument<
      DocumentType,
      ParticipantSelectionType,
      EditorDocumentType
    >
  ): Effect.Effect<
    StoredLiveDocument<
      DocumentType,
      ParticipantSelectionType,
      EditorDocumentType
    >
  > =>
    pipe(
      SubscriptionRef.get(document.content),
      Effect.flatMap((initialState) =>
        Effect.all({
          errorChannel: createErrorChannel<
            | LocalEditsContributionError
            | StoredContentReadError
            | StoredCopyWriteError
          >(),
          // The document is the store's, the base the live document's: opened
          // privately those agree, since the live document was started from
          // this very document. Opened at a share they potentially do not.
          stored: Ref.make(
            storedCopy({ document: initial, base: initialState.version })
          ),
          persistSemaphore: Effect.makeSemaphore(1),
        })
      ),
      Effect.flatMap(({ errorChannel, stored, persistSemaphore }) => {
        const report = (
          error:
            | LocalEditsContributionError
            | StoredContentReadError
            | StoredCopyWriteError
        ) => Effect.asVoid(PubSub.publish(errorChannel, error));

        // Persistence ops run strictly one after another: the next starts
        // only after the previous has fully finished.
        const persistMutex = persistSemaphore.withPermits(1);

        const persist = (state: ConvergentDocumentState<DocumentType>) =>
          pipe(
            Ref.get(stored),
            Effect.flatMap((copy) =>
              // What the store already holds is not written again.
              areEqual(state.doc, copy.document)
                ? Effect.void
                : write({ projectId, documentId, document: state.doc })
            ),
            Effect.zipRight(
              Ref.set(
                stored,
                storedCopy({ document: state.doc, base: state.version })
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
            Effect.suspend(() => read({ projectId, documentId })),
            Effect.flatMap((fresh) =>
              pipe(
                Ref.get(stored),
                Effect.flatMap((copy) =>
                  // Content the store already holds is a write or read of
                  // our own coming back, not an edit made by another hand.
                  areEqual(fresh, copy.document)
                    ? Effect.void
                    : pipe(
                        // The disk content was derived from the state we
                        // last wrote or read, so anchor the change there.
                        document.change(fresh, { base: copy.base }),
                        Effect.flatMap((version) =>
                          Ref.set(
                            stored,
                            storedCopy({ document: fresh, base: version })
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
            // What the disk holds belongs to another branch, so there is
            // nothing of this document to pick up.
            Effect.catchTag(
              VersionedProjectDocumentNotOnCurrentRefErrorTag,
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
          Effect.suspend(() => Fiber.interrupt(refreshingOnStoreChanges)),
          Effect.zipRight(Effect.sync(() => unsubscribeFromContent())),
          // Pending typing is contributed and the file written before the
          // document closes. It closes even when that fails, and the
          // failure is raised.
          Effect.zipRight(pipe(flush, Effect.ensuring(document.close)))
        );

        // The store may announce changes that don't concern this document.
        // Most settle in a read and an unchanged-content comparison, without
        // reaching the editor. Listening runs on a fiber of its own, so the
        // document can be handed over while it listens, and `close` stops
        // listening by interrupting that fiber.
        const refreshingOnStoreChanges = Effect.runFork(
          Stream.runForEach(
            projectContentChangeEvents({ projectId, emitOnStart: true }),
            () =>
              // `close` interrupts only the listening fiber, so no new refreshes
              // start after it. Refreshes already started run on daemon fibers
              // that `close` doesn't touch, so they run to the end.
              Effect.forkDaemon(refresh)
          )
        );

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

        const kept: StoredLiveDocument<
          DocumentType,
          ParticipantSelectionType,
          EditorDocumentType
        > = {
          documentId: document.documentId,
          content: document.content,
          currentDocument: document.currentDocument,
          change: document.change,
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
            areEqual(current.doc, initial)
              ? Effect.void
              : pipe(flush, Effect.catchAll(report))
          ),
          Effect.as(kept)
        );
      })
    );
