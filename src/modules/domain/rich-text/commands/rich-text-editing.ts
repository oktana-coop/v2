import debounce from 'debounce';
import * as Deferred from 'effect/Deferred';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as PubSub from 'effect/PubSub';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';

import { createErrorChannel } from '../../../../utils/effect';
import { mapErrorTo } from '../../../../utils/errors';
import {
  type ConvergentDocumentChangeOptions,
  type ConvergentDocumentVersion,
  type EditContributor,
  LocalEditsContributionError,
} from '../../collaboration';
import { primaryRichTextDocument, type RichTextDocument } from '../models';
import {
  type RepresentationTransform,
  type RichTextConvergentDocument,
} from '../ports';
import { toPrimaryTextRepresentation } from './to-primary-text-representation';

export type RichTextEditingDeps = {
  transformToText: RepresentationTransform['transformToText'];
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

// How the editor's edits reach a rich-text document: the editor's whole
// document on every edit, contributed as the primary text once typing pauses.
export const richTextEditing =
  ({ transformToText }: RichTextEditingDeps) =>
  (
    document: Pick<RichTextConvergentDocument, 'content' | 'change'>
  ): Effect.Effect<EditContributor<RichTextDocument>> =>
    pipe(
      Effect.all({
        errorChannel: createErrorChannel<LocalEditsContributionError>(),
        contributionSemaphore: Effect.makeSemaphore(1),
      }),
      Effect.map(({ errorChannel, contributionSemaphore }) => {
        const report = (error: LocalEditsContributionError) =>
          Effect.asVoid(PubSub.publish(errorChannel, error));

        const toPrimaryRepresentation = toPrimaryTextRepresentation({
          transformToText,
        });

        const currentVersion = pipe(
          SubscriptionRef.get(document.content),
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
            Effect.mapError(mapErrorTo(LocalEditsContributionError)),
            Effect.flatMap((text) =>
              document.change(primaryRichTextDocument(text), {
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

        const forgetPastContributions = Effect.sync(() => {
          lastApplied = null;
        });

        const close = (closeDocument: Effect.Effect<void>) =>
          pipe(
            Effect.sync(() => debouncedContribute.clear()),
            Effect.zipRight(contributionMutex(closeDocument))
          );

        return {
          edit,
          applyPendingLocalEdits,
          dropPendingLocalEdits,
          forgetPastContributions,
          close,
          errors: Stream.fromPubSub(errorChannel),
        };
      })
    );
