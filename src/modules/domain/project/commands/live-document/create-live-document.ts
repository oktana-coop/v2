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
import { type DocumentSharing, type ShareId } from '../../ports';
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

// The editor's document waiting to be contributed, the base it names, and
// the version that contribution will resolve with.
type PendingContribution = {
  doc: RichTextDocument;
  base: ConvergentDocumentVersion | undefined;
  version: Deferred.Deferred<ConvergentDocumentVersion>;
};

const startPendingContribution = ({
  doc,
  base,
}: {
  doc: RichTextDocument;
  base: ConvergentDocumentVersion | undefined;
}): Effect.Effect<PendingContribution> =>
  pipe(
    Deferred.make<ConvergentDocumentVersion>(),
    Effect.map((version) => ({ doc, base, version }))
  );

// A newer editor doc replaces the pending one outright: it already contains
// every edit the pending one had. The version stays, so whoever waited for
// the earlier doc resolves with the contribution that carries it.
const replacePendingContribution = ({
  previous,
  doc,
  base,
}: {
  previous: PendingContribution;
  doc: RichTextDocument;
  base: ConvergentDocumentVersion | undefined;
}): PendingContribution => ({ ...previous, doc, base });

// The base the editor's last applied contribution used, and the version
// it resolved with.
type AppliedContribution = {
  base: ConvergentDocumentVersion;
  result: ConvergentDocumentVersion;
};

const extendsContribution = ({
  pending,
  applied,
}: {
  pending: PendingContribution;
  applied: AppliedContribution;
}): boolean => pending.base === applied.base;

// The version pending typing derives from: the last applied contribution's
// result when it extends that contribution, the base it names otherwise.
const versionTypingDerivesFrom = ({
  pending,
  lastApplied,
}: {
  pending: PendingContribution;
  lastApplied: AppliedContribution | null;
}): ConvergentDocumentVersion | undefined =>
  lastApplied !== null && extendsContribution({ pending, applied: lastApplied })
    ? lastApplied.result
    : pending.base;

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
          let lastApplied: AppliedContribution | null = null;

          const takePending = Effect.sync(() => {
            debouncedContribute.clear();
            const taken = pending;
            pending = null;
            return taken;
          });

          // Contributions reach the document one after another, in the
          // order they were made.
          const contributionMutex = contributionSemaphore.withPermits(1);

          const contributeTyping = (pending: PendingContribution) =>
            pipe(
              toPrimaryRepresentation(pending.doc),
              Effect.flatMap((text) =>
                convergentDocument.change(text, {
                  base: versionTypingDerivesFrom({ pending, lastApplied }),
                })
              ),
              Effect.tap((result) =>
                Effect.sync(() => {
                  if (pending.base) {
                    lastApplied = { base: pending.base, result };
                  }
                })
              ),
              Effect.flatMap((result) =>
                Deferred.succeed(pending.version, result)
              ),
              Effect.asVoid
            );

          // Typing that could not be contributed goes back on its way, for
          // the next contribution to retry. Typing made meanwhile carries it
          // already.
          const keepPending = (taken: PendingContribution) =>
            Effect.suspend(() =>
              pending === null
                ? Effect.sync(() => {
                    pending = taken;
                  })
                : Effect.asVoid(
                    Deferred.completeWith(
                      taken.version,
                      Deferred.await(pending.version)
                    )
                  )
            );

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
                      contributeTyping(taken),
                      Effect.tapError(() => keepPending(taken))
                    )
              )
            )
          );

          const debouncedContribute = debounce(() => {
            Effect.runFork(
              pipe(
                applyPendingLocalEdits,
                // Started by the document itself, so its failure is published.
                Effect.catchAll(report)
              )
            );
          }, CONTRIBUTION_DEBOUNCE_MS);

          const edit = (
            doc: RichTextDocument,
            options?: ConvergentDocumentChangeOptions
          ) =>
            pipe(
              Effect.suspend(() =>
                pending === null
                  ? startPendingContribution({ doc, base: options?.base })
                  : Effect.succeed(
                      replacePendingContribution({
                        previous: pending,
                        doc,
                        base: options?.base,
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
              Effect.flatMap(convergentDocument.switchTo),
              // Versions of the document left mean nothing on the next one.
              Effect.tap(() =>
                Effect.sync(() => {
                  lastApplied = null;
                })
              )
            );

          const currentText = pipe(
            SubscriptionRef.get(convergentDocument.content),
            Effect.map((current) => current.doc.content)
          );

          const attachTo = (shareId: ShareId) =>
            switchTo(openSharedDocument({ shareId }));

          // The content goes with it: leaving a share keeps what the share
          // left the document holding.
          const detach = switchTo(
            pipe(currentText, Effect.flatMap(createPrivateDocument))
          );

          const close = pipe(
            Effect.sync(() => debouncedContribute.clear()),
            Effect.zipRight(contributionMutex(convergentDocument.close))
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
