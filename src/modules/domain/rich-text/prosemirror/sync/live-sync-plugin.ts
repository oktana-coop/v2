import * as Effect from 'effect/Effect';
import * as Either from 'effect/Either';
import { pipe } from 'effect/Function';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { type Node, type Schema } from 'prosemirror-model';
import { Plugin, PluginKey, type Transaction } from 'prosemirror-state';
import { type Step } from 'prosemirror-transform';

import { forEachLatestRefChange } from '../../../../../utils/effect';
import { mapErrorTo } from '../../../../../utils/errors';
import {
  LiveSyncFallbackError,
  type PatchError,
  RepresentationTransformError,
  type RichTextLibError,
  WebEditorError,
} from '../../errors';
import { type RichTextDocument, richTextRepresentations } from '../../models';
import {
  type ConvergentDocumentChangeOptions,
  type ConvergentDocumentState,
  type ConvergentDocumentVersion,
} from '../../ports/convergent-document';
import { type ProseMirrorStepsResult } from '../../ports/diff-patch';
import { pmDocToJSONString } from '../json';
import {
  ensureTrailingParagraphInDoc,
  stripTrailingParagraphFromDoc,
} from '../trailing-paragraph';
import { coarseDiffReplace, patch } from './patching';

const pluginKey = new PluginKey('pm-live-sync');

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
  new Plugin({
    key: pluginKey,
    view(view) {
      // The version currently shown in the editor.
      let editorDocVersion = initialVersion;
      let applyingIncoming = false;
      // A published state can lag typing still in flight; a diff cannot
      // tell that apart from a remote deletion.
      let contributionsInFlight = 0;

      // The trailing paragraph is the editor's own and ends the doc, so
      // steps computed without it hold on the live doc as well.
      const stepsTo = (doc: RichTextDocument) =>
        proseMirrorSteps({
          pmDocBefore: stripTrailingParagraphFromDoc({
            doc: view.state.doc,
            schema,
          }),
          docAfter: doc,
        });

      const toProseMirror = (doc: RichTextDocument) =>
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

      const dispatchIncoming = (tr: Transaction) => {
        tr.setMeta('addToHistory', false);
        tr.setMeta(pluginKey, { incoming: true });

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

      const applyToView = (incoming: IncomingUpdate) => {
        // The editor keeps a trailing paragraph the primary
        // representation cannot express.
        const target = ensureTrailingParagraphInDoc({
          doc: incoming.pmDocAfter,
          schema,
        });
        if (target.eq(view.state.doc)) return;

        dispatchIncoming(transactionTo({ target, incoming }));
      };

      const isStale = ({
        change,
        latest,
      }: {
        change: ConvergentDocumentState;
        latest: ConvergentDocumentState;
      }) =>
        // The editor already shows this version;
        change.version === editorDocVersion ||
        // Typing that has not reached the document yet. Dropping is safe:
        // the resolving contribution publishes a superseding state that
        // carries it.
        contributionsInFlight > 0 ||
        // A state the document moved past while it converted; the newer
        // one is on its way through the buffer.
        latest.version !== change.version;

      // forEachLatestRefChange collapses a burst of changes to just the latest
      // while a slow apply is in flight; the version check before converting
      // to ProseMirror then skips it when it already matches what's shown.
      const applyChange = (change: ConvergentDocumentState) =>
        pipe(
          change.version === editorDocVersion
            ? Effect.void
            : pipe(
                toIncomingUpdate(change.doc),
                // Converting is asynchronous and other work runs while it
                // suspends, so the checks are repeated before applying.
                Effect.flatMap((incomingUpdate) =>
                  pipe(
                    SubscriptionRef.get(content),
                    Effect.flatMap((latest) =>
                      isStale({ change, latest })
                        ? Effect.void
                        : Effect.try({
                            try: () => {
                              applyToView(incomingUpdate);
                              editorDocVersion = change.version;
                            },
                            catch: mapErrorTo(
                              WebEditorError,
                              'Failed to apply a change to the editor'
                            ),
                          })
                    )
                  )
                )
              ),
          // Recover per change, so one bad change doesn't stop syncing.
          Effect.catchAll((error) => Effect.sync(() => onError(error)))
        );

      const unsubscribe = forEachLatestRefChange(content, applyChange);

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

          contributionsInFlight += 1;

          // `onChange` resolution is not awaited, therefore the version it
          // resolves with is recorded as `editorDocVersion` whenever it
          // completes. This helps the editor detect when a regular change is
          // an echo of local typing.
          Effect.runPromise(onChange(doc, { base: editorDocVersion }))
            .then((version) => {
              editorDocVersion = version;
            })
            .finally(() => {
              contributionsInFlight -= 1;
            });
        },
        destroy() {
          unsubscribe();
        },
      };
    },
  });
