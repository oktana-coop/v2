import * as Effect from 'effect/Effect';
import * as Either from 'effect/Either';
import { pipe } from 'effect/Function';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { type Node, type Schema } from 'prosemirror-model';
import {
  type EditorState,
  Plugin,
  PluginKey,
  type Transaction,
} from 'prosemirror-state';
import { type Step } from 'prosemirror-transform';

import { runOnLatestRefChange } from '../../../../../utils/effect';
import { mapErrorTo } from '../../../../../utils/errors';
import {
  LiveSyncFallbackError,
  type PatchError,
  RepresentationTransformError,
  type RichTextLibError,
  WebEditorError,
} from '../../errors';
import {
  type ConvergentDocumentVersion,
  type RichTextDocument,
  richTextRepresentations,
} from '../../models';
import {
  type ConvergentDocumentChangeOptions,
  type ConvergentDocumentState,
} from '../../ports/convergent-document';
import { type ProseMirrorStepsResult } from '../../ports/diff-patch';
import { pmDocToJSONString } from '../json';
import {
  ensureTrailingParagraphInDoc,
  stripTrailingParagraphFromDoc,
} from '../trailing-paragraph';
import { coarseDiffReplace, patch } from './patching';

const pluginKey = new PluginKey<LiveSyncState>('pm-live-sync');

// What the editor shows of the live document, so that other plugins can read it.
export type LiveSyncState = {
  // The version the editor's document is built on.
  baseVersion: ConvergentDocumentVersion;
  // Whether local edits are still on their way to the live document, in
  // which case the editor's document is ahead of that version.
  hasPendingLocalEdits: boolean;
};

// After this transaction, the editor shows this version.
type LiveSyncMeta = { version: ConvergentDocumentVersion };

export const getLiveSyncState = (state: EditorState): LiveSyncState =>
  pluginKey.getState(state) as LiveSyncState;

export type LiveSyncPluginArgs = {
  content: SubscriptionRef.SubscriptionRef<ConvergentDocumentState>;
  onChange: (
    doc: RichTextDocument,
    options?: ConvergentDocumentChangeOptions
  ) => Effect.Effect<ConvergentDocumentVersion>;
  initialVersion: ConvergentDocumentVersion;
  schemaVersion: number;
  schema: Schema;
  proseMirrorSteps: (args: {
    pmDocBefore: Node;
    docAfter: RichTextDocument;
  }) => Effect.Effect<ProseMirrorStepsResult, PatchError | RichTextLibError>;
  convertToProseMirror: (doc: RichTextDocument) => Promise<Node>;
  onError: (error: unknown) => void;
};

// A published state in ProseMirror form, and how the editor gets there: by
// the exact steps to it, or by a region replace when they could not be
// computed.
type IncomingUpdate =
  | { kind: 'patch'; pmDocAfter: Node; steps: Step[] }
  | {
      kind: 'replace';
      pmDocAfter: Node;
      failure: PatchError | RichTextLibError;
    };

export const liveSyncPlugin = ({
  content,
  onChange,
  initialVersion,
  schemaVersion,
  schema,
  proseMirrorSteps,
  convertToProseMirror,
  onError,
}: LiveSyncPluginArgs) =>
  new Plugin<LiveSyncState>({
    key: pluginKey,
    state: {
      init: () => ({
        baseVersion: initialVersion,
        hasPendingLocalEdits: false,
      }),
      // A transaction that brings a version brings the editor to it; a local
      // edit is pending until the document resolves it with one.
      apply(tr, current, oldState, newState) {
        const meta: LiveSyncMeta | undefined = tr.getMeta(pluginKey);

        if (meta !== undefined)
          return { baseVersion: meta.version, hasPendingLocalEdits: false };

        return newState.doc.eq(oldState.doc)
          ? current
          : { ...current, hasPendingLocalEdits: true };
      },
    },
    view(view) {
      let applyingIncoming = false;

      // Local edits handed to the document, not yet resolved with a version.
      const contributionsInFlight = Effect.runSync(SubscriptionRef.make(0));

      // Resolves once no contribution is in flight, right away when none is.
      const whenNoContributionInFlight: Effect.Effect<void> = pipe(
        contributionsInFlight.changes,
        Stream.filter((count) => count === 0),
        Stream.runHead,
        Effect.asVoid
      );

      const markContributionAsResolved = (
        version?: ConvergentDocumentVersion
      ) => {
        const remainingInFlight =
          Effect.runSync(SubscriptionRef.get(contributionsInFlight)) - 1;

        if (
          remainingInFlight === 0 &&
          version !== undefined &&
          !view.isDestroyed
        ) {
          view.dispatch(view.state.tr.setMeta(pluginKey, { version }));
        }

        Effect.runSync(
          SubscriptionRef.set(contributionsInFlight, remainingInFlight)
        );
      };

      // The trailing paragraph is the editor's own and ends the doc, so
      // steps computed without it hold on the live doc as well.
      const stepsTo = (
        doc: RichTextDocument
      ): Effect.Effect<ProseMirrorStepsResult, PatchError | RichTextLibError> =>
        proseMirrorSteps({
          pmDocBefore: stripTrailingParagraphFromDoc({
            doc: view.state.doc,
            schema,
          }),
          docAfter: doc,
        });

      const toProseMirror = (
        doc: RichTextDocument
      ): Effect.Effect<Node, RepresentationTransformError> =>
        Effect.tryPromise({
          try: () => convertToProseMirror(doc),
          catch: mapErrorTo(
            RepresentationTransformError,
            'Failed to convert the document to ProseMirror'
          ),
        });

      const toIncomingUpdate = (
        doc: RichTextDocument
      ): Effect.Effect<IncomingUpdate, RepresentationTransformError> =>
        pipe(
          stepsTo(doc),
          Effect.map((result): IncomingUpdate => ({
            kind: 'patch',
            ...result,
          })),
          Effect.catchAll((failure) =>
            pipe(
              toProseMirror(doc),
              Effect.map((pmDocAfter): IncomingUpdate => ({
                kind: 'replace',
                pmDocAfter,
                failure,
              }))
            )
          )
        );

      const dispatchIncoming = ({
        tr,
        version,
      }: {
        tr: Transaction;
        version: ConvergentDocumentVersion;
      }) => {
        tr.setMeta('addToHistory', false);
        tr.setMeta(pluginKey, { version });

        applyingIncoming = true;
        try {
          view.dispatch(tr);
        } finally {
          applyingIncoming = false;
        }
      };

      // The region replace still converges: a fallback is reported, not
      // raised.
      const fallbackToCoarseDiffReplace = ({
        target,
        error,
      }: {
        target: Node;
        error: LiveSyncFallbackError;
      }) => {
        onError(error);
        return coarseDiffReplace({ state: view.state, target });
      };

      const transactionTo = ({
        target,
        incoming,
      }: {
        target: Node;
        incoming: IncomingUpdate;
      }): Transaction => {
        if (incoming.kind === 'replace') {
          return fallbackToCoarseDiffReplace({
            target,
            error: new LiveSyncFallbackError(
              `Steps could not be computed: ${incoming.failure.message}`,
              { reason: 'steps-failed' }
            ),
          });
        }

        return pipe(
          patch({ state: view.state, steps: incoming.steps, target }),
          Either.getOrElse((error) =>
            fallbackToCoarseDiffReplace({
              target,
              error: new LiveSyncFallbackError(error.message, {
                reason: 'steps-mismatch',
              }),
            })
          )
        );
      };

      const applyToView = ({
        incoming,
        version,
      }: {
        incoming: IncomingUpdate;
        version: ConvergentDocumentVersion;
      }) => {
        // The editor keeps a trailing paragraph the primary
        // representation cannot express.
        const target = ensureTrailingParagraphInDoc({
          doc: incoming.pmDocAfter,
          schema,
        });

        // A state the editor already shows still names a version to adopt.
        dispatchIncoming({
          tr: target.eq(view.state.doc)
            ? view.state.tr
            : transactionTo({ target, incoming }),
          version,
        });
      };

      const currentlyShows = (version: ConvergentDocumentVersion) =>
        version === getLiveSyncState(view.state).baseVersion;

      // Whether typing or a newer state came in since this state was read.
      const isStale = (
        state: ConvergentDocumentState
      ): Effect.Effect<boolean> =>
        pipe(
          Effect.all({
            latest: SubscriptionRef.get(content),
            inFlight: SubscriptionRef.get(contributionsInFlight),
          }),
          Effect.map(
            ({ latest, inFlight }) =>
              inFlight > 0 || latest.version !== state.version
          )
        );

      const applyIncoming = ({
        incoming,
        version,
      }: {
        incoming: IncomingUpdate;
        version: ConvergentDocumentVersion;
      }): Effect.Effect<void, WebEditorError> =>
        Effect.try({
          try: () => {
            applyToView({ incoming, version });
          },
          catch: mapErrorTo(
            WebEditorError,
            'Failed to apply a change to the editor'
          ),
        });

      // Brings the editor to the latest published state. It waits for
      // contributions in flight first: a state published meanwhile may be
      // their own echo, which only its version tells apart, and that is
      // known once they resolve. runOnLatestRefChange collapses a burst of
      // changes to just the latest while this runs.
      const applyLatest: Effect.Effect<void> = pipe(
        whenNoContributionInFlight,
        Effect.zipRight(SubscriptionRef.get(content)),
        Effect.flatMap((latest) =>
          currentlyShows(latest.version)
            ? Effect.void
            : pipe(
                toIncomingUpdate(latest.doc),
                Effect.flatMap((incoming) =>
                  pipe(
                    isStale(latest),
                    Effect.flatMap((stale) =>
                      stale
                        ? Effect.suspend(() => applyLatest)
                        : applyIncoming({ incoming, version: latest.version })
                    )
                  )
                )
              )
        ),
        // Recover per change, so one bad change doesn't stop syncing.
        Effect.catchAll((error) => Effect.sync(() => onError(error)))
      );

      const unsubscribe = runOnLatestRefChange(content, applyLatest);

      return {
        // React to local ProseMirror changes
        update(view, prevState) {
          if (applyingIncoming) return;
          if (view.state.doc.eq(prevState.doc)) return;

          const doc: RichTextDocument = {
            schemaVersion,
            representation: richTextRepresentations.PROSEMIRROR,
            content: pmDocToJSONString(view.state.doc),
          };

          Effect.runSync(
            SubscriptionRef.update(contributionsInFlight, (count) => count + 1)
          );

          // `onChange` resolution is not awaited because `update` is synchronous.
          // When it resolves, the plugin dispatches a transaction with meta,
          // updating the now settled version. This lets the editor detect when a
          // regular change is an echo of local typing, and other plugins learn
          // about this fact.
          Effect.runPromise(
            onChange(doc, { base: getLiveSyncState(view.state).baseVersion })
          ).then(
            (version) => {
              markContributionAsResolved(version);
            },
            (error) => {
              markContributionAsResolved();
              onError(error);
            }
          );
        },
        destroy() {
          unsubscribe();
        },
      };
    },
  });
