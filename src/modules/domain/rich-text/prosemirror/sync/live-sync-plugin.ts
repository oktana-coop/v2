import * as Effect from 'effect/Effect';
import { type Node, type Schema } from 'prosemirror-model';
import {
  Plugin,
  PluginKey,
  Selection,
  type Transaction,
} from 'prosemirror-state';

import { subscribeToRef } from '../../../../../utils/effect';
import { type RichTextDocument, richTextRepresentations } from '../../models';
import {
  type LiveDocument,
  type LiveDocumentChange,
  type LiveDocumentVersion,
} from '../../ports/live-document';
import { pmDocFromJSONString, pmDocToJSONString } from '../json';

const pluginKey = new PluginKey('pm-live-sync');

export type LiveSyncPluginArgs = {
  live: LiveDocument;
  initialVersion: LiveDocumentVersion;
  schemaVersion: number;
  schema: Schema;
  convertToProseMirror: (doc: RichTextDocument) => Promise<Node>;
  onError: (error: unknown) => void;
};

export const liveSyncPlugin = ({
  live,
  initialVersion,
  schemaVersion,
  schema,
  convertToProseMirror,
  onError,
}: LiveSyncPluginArgs) =>
  new Plugin({
    key: pluginKey,
    view(view) {
      let reflectedVersion = initialVersion;
      let applyingIncoming = false;
      let processing = false;
      let latest: LiveDocumentChange | null = null;

      const toProseMirrorDoc = (doc: RichTextDocument) =>
        doc.representation === richTextRepresentations.PROSEMIRROR
          ? Promise.resolve(
              pmDocFromJSONString(JSON.parse(doc.content), schema)
            )
          : convertToProseMirror(doc);

      const selectionAfter = (tr: Transaction, head: number) => {
        try {
          const pos = Math.min(tr.mapping.map(head), tr.doc.content.size);
          return Selection.near(tr.doc.resolve(pos));
        } catch {
          return Selection.atStart(tr.doc);
        }
      };

      const applyIncoming = (next: LiveDocumentChange, newPmDoc: Node) => {
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

        reflectedVersion = next.version;
      };

      const applyLatest = async () => {
        if (processing) return;
        processing = true;

        try {
          while (latest !== null) {
            const next = latest;
            latest = null;

            if (next.version === reflectedVersion) continue;

            const newPmDoc = await toProseMirrorDoc(next.doc);

            if (newPmDoc.eq(view.state.doc)) {
              reflectedVersion = next.version;
              continue;
            }

            applyIncoming(next, newPmDoc);
          }
        } catch (error) {
          onError(error);
        } finally {
          processing = false;
        }
      };

      const unsubscribe = subscribeToRef(live.content, (change) => {
        latest = change;
        void applyLatest();
      });

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

          Effect.runPromise(live.change(doc))
            .then((version) => {
              reflectedVersion = version;
            })
            .catch(onError);
        },
        destroy() {
          unsubscribe();
        },
      };
    },
  });
