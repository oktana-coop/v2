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
  type LiveDocument,
  type LiveDocumentChange,
  type LiveDocumentVersion,
} from '../../ports/live-document';
import { ensureTrailingParagraphInDoc } from '../blocks';
import { pmDocFromJSONString, pmDocToJSONString } from '../json';

const pluginKey = new PluginKey('pm-live-sync');

export type LiveSyncPluginArgs = {
  liveDocument: LiveDocument;
  initialVersion: LiveDocumentVersion;
  schemaVersion: number;
  schema: Schema;
  convertToProseMirror: (doc: RichTextDocument) => Promise<Node>;
  onError: (error: unknown) => void;
};

export const liveSyncPlugin = ({
  liveDocument,
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
        change: LiveDocumentChange;
        newPmDoc: Node;
      }) => {
        const { state } = view;
        const tr =
          minimalReplace(state, newPmDoc) ??
          state.tr.replaceWith(0, state.doc.content.size, newPmDoc.content);

        tr.setMeta('addToHistory', false);
        tr.setMeta(pluginKey, { fromLiveDocument: true });

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
        change: LiveDocumentChange;
        newPmDoc: Node;
      }): Effect.Effect<void, WebEditorError> =>
        Effect.try({
          try: () => {
            // The version guard, re-checked: an own echo can arrive before
            // its contribution resolved with the version to recognize it by.
            if (change.version === editorDocVersion) return;

            // Dropping is safe: the resolving contribution publishes a
            // superseding state that carries the typed text.
            if (contributionsInFlight > 0) return;

            // A state the document moved past while it converted; the newer
            // one is on its way through the buffer.
            const latest = Effect.runSync(
              SubscriptionRef.get(liveDocument.content)
            );
            if (latest.version !== change.version) return;

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
      // while a slow apply is in flight; the version guard then skips it when
      // it already matches what's shown.
      const applyChange = (change: LiveDocumentChange) =>
        pipe(
          change.version === editorDocVersion
            ? Effect.void
            : pipe(
                toProseMirrorDoc(change.doc),
                Effect.flatMap((newPmDoc) => applyToView({ change, newPmDoc }))
              ),
          // Recover per change, so one bad change doesn't stop syncing.
          Effect.catchAll((error) => Effect.sync(() => onError(error)))
        );

      const unsubscribe = forEachLatestRefChange(
        liveDocument.content,
        applyChange
      );

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

          // update() is synchronous, so the change runs as a background task.
          // The version it resolves with is the state carrying exactly this
          // content: adopting it lets the version guard recognize the echo
          // without converting it — a state with any other version carries
          // something this editor has not seen.
          contributionsInFlight += 1;
          Effect.runPromise(
            liveDocument.change(doc, { base: editorDocVersion })
          )
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
