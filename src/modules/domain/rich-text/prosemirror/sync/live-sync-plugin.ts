import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import { type Node, type Schema } from 'prosemirror-model';
import {
  Plugin,
  PluginKey,
  Selection,
  type Transaction,
} from 'prosemirror-state';

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

      const selectionAfter = (tr: Transaction, head: number) => {
        try {
          const pos = Math.min(tr.mapping.map(head), tr.doc.content.size);
          return Selection.near(tr.doc.resolve(pos));
        } catch {
          return Selection.atStart(tr.doc);
        }
      };

      const applyIncoming = ({
        change,
        newPmDoc,
      }: {
        change: LiveDocumentChange;
        newPmDoc: Node;
      }) => {
        const { state } = view;
        const tr = state.tr.replaceWith(
          0,
          state.doc.content.size,
          newPmDoc.content
        );

        tr.setSelection(selectionAfter(tr, state.selection.head));
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
            if (newPmDoc.eq(view.state.doc)) {
              editorDocVersion = change.version;
            } else {
              applyIncoming({ change, newPmDoc });
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

          // update() is synchronous, so run the change as a fire-and-forget task.
          Effect.runPromise(
            liveDocument.change(doc, { base: editorDocVersion })
          );
        },
        destroy() {
          unsubscribe();
        },
      };
    },
  });
