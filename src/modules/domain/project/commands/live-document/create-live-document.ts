import debounce from 'debounce';
import * as Deferred from 'effect/Deferred';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as PubSub from 'effect/PubSub';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';

import {
  type ConvergentDocument,
  type ConvergentDocumentChangeOptions,
  type ConvergentDocumentVersion,
  type RepresentationTransform,
  type RichTextDocument,
  toPrimaryTextRepresentation,
} from '../../../../../modules/domain/rich-text';
import { type ArtifactId } from '../../../../../modules/infrastructure/version-control';
import { createErrorChannel } from '../../../../../utils/effect';
import { type DocumentSharing, type ShareUrl } from '../../ports';
import { type LiveDocument, type LiveDocumentError } from './live-document';
import { createSwitchableDocument } from './switchable-convergent-document';

export type CreateLiveDocumentDeps = {
  // Starts a document nobody else can reach, from the given text. Nothing
  // about it can fail: there is no link to reach and no format to read.
  createPrivateDocument: (
    initialText: string
  ) => Effect.Effect<ConvergentDocument>;
  openSharedDocument: DocumentSharing['openSharedDocument'];
  transformToText: RepresentationTransform['transformToText'];
};

export type CreateLiveDocumentArgs = {
  documentId: ArtifactId;
  // The document to run on first. Sharing, joining and leaving replace it.
  initialDocument: ConvergentDocument;
};

// Converting a large document to the primary text is slow, so typing is
// contributed once it pauses rather than keystroke by keystroke.
const CONTRIBUTION_DEBOUNCE_MS = 300;

// The editor's document waiting to be contributed, and the version that
// contribution will resolve with.
type PendingContribution = {
  doc: RichTextDocument;
  options: ConvergentDocumentChangeOptions | undefined;
  version: Deferred.Deferred<ConvergentDocumentVersion>;
};

const startPendingContribution = ({
  doc,
  options,
}: {
  doc: RichTextDocument;
  options: ConvergentDocumentChangeOptions | undefined;
}): Effect.Effect<PendingContribution> =>
  pipe(
    Deferred.make<ConvergentDocumentVersion>(),
    Effect.map((version) => ({ doc, options, version }))
  );

// A newer editor doc replaces the pending one outright: it already contains
// every edit the pending one had. The version stays, so whoever waited for
// the earlier doc resolves with the contribution that carries it.
const replacePendingContribution = ({
  previous,
  doc,
  options,
}: {
  previous: PendingContribution;
  doc: RichTextDocument;
  options: ConvergentDocumentChangeOptions | undefined;
}): PendingContribution => ({ ...previous, doc, options });

export const createLiveDocument =
  ({
    createPrivateDocument,
    openSharedDocument,
    transformToText,
  }: CreateLiveDocumentDeps) =>
  ({
    documentId,
    initialDocument,
  }: CreateLiveDocumentArgs): Effect.Effect<
    LiveDocument & Pick<ConvergentDocument, 'change'>
  > =>
    pipe(
      Effect.all({
        errorChannel: createErrorChannel<LiveDocumentError>(),
        convergentDocument: createSwitchableDocument({
          initial: initialDocument,
        }),
        contributionSemaphore: Effect.makeSemaphore(1),
      }),
      Effect.map(
        ({ errorChannel, convergentDocument, contributionSemaphore }) => {
          const report = (error: LiveDocumentError) =>
            Effect.asVoid(PubSub.publish(errorChannel, error));

          const toPrimaryRepresentation = toPrimaryTextRepresentation({
            transformToText,
          });

          const currentVersion = pipe(
            SubscriptionRef.get(convergentDocument.content),
            Effect.map((current) => current.version)
          );

          let pending: PendingContribution | null = null;

          const takePending = Effect.sync(() => {
            debouncedContribute.clear();
            const taken = pending;
            pending = null;
            return taken;
          });

          // Contributions reach the document one after another, in the
          // order they were made.
          const contributionMutex = contributionSemaphore.withPermits(1);

          // Contributes the editor's edits still on their way to the
          // document now, without waiting for the pause that normally
          // contributes them.
          const applyPendingLocalEdits = contributionMutex(
            pipe(
              takePending,
              Effect.flatMap((taken) =>
                taken === null
                  ? Effect.void
                  : pipe(
                      toPrimaryRepresentation(taken.doc),
                      Effect.flatMap((text) =>
                        convergentDocument.change(text, taken.options)
                      ),
                      // Contributing has no error channel: a failed
                      // conversion is reported and leaves the document as
                      // it was.
                      Effect.catchAll((error) =>
                        pipe(report(error), Effect.zipRight(currentVersion))
                      ),
                      Effect.flatMap((version) =>
                        Deferred.succeed(taken.version, version)
                      ),
                      Effect.asVoid
                    )
              )
            )
          );

          const debouncedContribute = debounce(() => {
            Effect.runFork(applyPendingLocalEdits);
          }, CONTRIBUTION_DEBOUNCE_MS);

          const edit = (
            doc: RichTextDocument,
            options?: ConvergentDocumentChangeOptions
          ) =>
            pipe(
              Effect.suspend(() =>
                pending === null
                  ? startPendingContribution({ doc, options })
                  : Effect.succeed(
                      replacePendingContribution({
                        previous: pending,
                        doc,
                        options,
                      })
                    )
              ),
              Effect.tap((next) =>
                Effect.sync(() => {
                  pending = next;
                  debouncedContribute();
                })
              ),
              Effect.flatMap((next) => Deferred.await(next.version))
            );

          // Drops the editor's edits still on their way to the document;
          // whoever waits for them gets the version the document holds.
          const dropPendingLocalEdits = contributionMutex(
            pipe(
              takePending,
              Effect.flatMap((taken) =>
                taken === null
                  ? Effect.void
                  : pipe(
                      currentVersion,
                      Effect.flatMap((version) =>
                        Deferred.succeed(taken.version, version)
                      ),
                      Effect.asVoid
                    )
              )
            )
          );

          // Runs on another document from here on. Typing still on its way
          // is contributed to the document it was made on first.
          const switchTo = <E>(open: Effect.Effect<ConvergentDocument, E>) =>
            pipe(
              applyPendingLocalEdits,
              Effect.zipRight(open),
              Effect.flatMap(convergentDocument.switchTo)
            );

          const currentText = pipe(
            SubscriptionRef.get(convergentDocument.content),
            Effect.map((current) => current.doc.content)
          );

          const attachTo = (shareUrl: ShareUrl) =>
            switchTo(openSharedDocument({ shareUrl }));

          // The content goes with it: leaving a share keeps what the share
          // left the document holding.
          const detach = switchTo(
            pipe(currentText, Effect.flatMap(createPrivateDocument))
          );

          const close = pipe(
            applyPendingLocalEdits,
            Effect.zipRight(convergentDocument.close)
          );

          const errors = Stream.merge(
            Stream.fromPubSub(errorChannel),
            convergentDocument.errors
          );

          return {
            documentId,
            content: convergentDocument.content,
            edit,
            applyPendingLocalEdits,
            dropPendingLocalEdits,
            presence: convergentDocument.presence,
            attachTo,
            detach,
            change: convergentDocument.change,
            errors,
            close,
          };
        }
      )
    );
