import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { type Node, type Schema } from 'prosemirror-model';
import { type EditorState, Plugin, PluginKey } from 'prosemirror-state';

import { forEachLatestRefChange } from '../../../../../utils/effect';
import { mapErrorTo } from '../../../../../utils/errors';
import {
  RepresentationTransformError,
  ValidationError,
  WebEditorError,
} from '../../errors';
import { type RichTextDocument, richTextRepresentations } from '../../models';
import {
  type ConvergentDocumentChangeOptions,
  type ConvergentDocumentState,
  type ConvergentDocumentVersion,
} from '../../ports/convergent-document';
import { ensureTrailingParagraphInDoc } from '../blocks';
import { pmDocFromJSONString, pmDocToJSONString } from '../json';

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
  convertToProseMirror: (doc: RichTextDocument) => Promise<Node>;
  onError: (error: unknown) => void;
};

export const liveSyncPlugin = ({
  content,
  onChange,
  initialVersion,
  schemaVersion,
  schema,
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

      const toProseMirrorDoc = (
        doc: RichTextDocument
      ): Effect.Effect<Node, RepresentationTransformError | ValidationError> =>
        doc.representation === richTextRepresentations.PROSEMIRROR
          ? Effect.try({
              try: () => pmDocFromJSONString(JSON.parse(doc.content), schema),
              catch: mapErrorTo(
                ValidationError,
                'Invalid stored ProseMirror document'
              ),
            })
          : Effect.tryPromise({
              try: () => convertToProseMirror(doc),
              catch: mapErrorTo(
                RepresentationTransformError,
                'Failed to convert the document to ProseMirror'
              ),
            });

      // Replaces only the slice that differs, so the caret keeps its place.
      // TODO: replace with v2-hs-lib's diffToTransaction once it exists —
      // minimal steps at exact positions instead of a single splice.
      const minimalReplace = (state: EditorState, newPmDoc: Node) => {
        const start = state.doc.content.findDiffStart(newPmDoc.content);
        const end = state.doc.content.findDiffEnd(newPmDoc.content);

        if (start === null || end === null) return null;

        let { a: endA, b: endB } = end;
        const overlap = start - Math.min(endA, endB);
        if (overlap > 0) {
          endA += overlap;
          endB += overlap;
        }

        return state.tr.replace(start, endA, newPmDoc.slice(start, endB));
      };

      const applyIncoming = ({
        change,
        newPmDoc,
      }: {
        change: ConvergentDocumentState;
        newPmDoc: Node;
      }) => {
        const { state } = view;
        const tr =
          minimalReplace(state, newPmDoc) ??
          state.tr.replaceWith(0, state.doc.content.size, newPmDoc.content);

        tr.setMeta('addToHistory', false);
        tr.setMeta(pluginKey, { incoming: true });

        applyingIncoming = true;
        try {
          view.dispatch(tr);
        } finally {
          applyingIncoming = false;
        }

        editorDocVersion = change.version;
      };

      const applyToView = ({
        change,
        newPmDoc,
      }: {
        change: ConvergentDocumentState;
        newPmDoc: Node;
      }): Effect.Effect<void, WebEditorError> =>
        Effect.try({
          try: () => {
            // The editor keeps a trailing paragraph the primary
            // representation cannot express.
            const incoming = ensureTrailingParagraphInDoc(newPmDoc, schema);

            if (incoming.eq(view.state.doc)) {
              editorDocVersion = change.version;
            } else {
              applyIncoming({ change, newPmDoc: incoming });
            }
          },
          catch: mapErrorTo(
            WebEditorError,
            'Failed to apply a change to the editor'
          ),
        });

      // forEachLatestRefChange collapses a burst of changes to just the latest
      // while a slow apply is in flight; the version check before converting
      // to ProseMirror then skips it when it already matches what's shown.
      const applyChange = (change: ConvergentDocumentState) =>
        pipe(
          change.version === editorDocVersion
            ? Effect.void
            : pipe(
                toProseMirrorDoc(change.doc),
                // Converting to ProseMirror is asynchronous and other work runs
                // while it suspends, so we have to repeat some checks before applying.
                Effect.flatMap((newPmDoc) =>
                  pipe(
                    SubscriptionRef.get(content),
                    Effect.flatMap((latest) => {
                      const shouldSkip =
                        // The editor already shows this version;
                        change.version === editorDocVersion ||
                        // Typing that has not reached the document yet.
                        // Dropping is safe: the resolving contribution
                        // publishes a superseding state that carries it.
                        contributionsInFlight > 0 ||
                        // A state the document moved past while it converted;
                        // the newer one is on its way through the buffer.
                        latest.version !== change.version;

                      return shouldSkip
                        ? Effect.void
                        : applyToView({ change, newPmDoc });
                    })
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
