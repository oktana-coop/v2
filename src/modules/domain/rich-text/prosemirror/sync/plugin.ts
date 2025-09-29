import { Node } from 'prosemirror-model';
import { Plugin, PluginKey } from 'prosemirror-state';

import { type VersionedDocumentHandle } from '../../models';

const pluginKey = new PluginKey('pm-sync');

type SyncPluginArgs = {
  onPMDocChange: (doc: Node) => void;
  docHandle: VersionedDocumentHandle | null;
};

export const syncPlugin = ({ onPMDocChange, docHandle }: SyncPluginArgs) =>
  new Plugin({
    key: pluginKey,
    view() {
      if (docHandle) {
        console.log('Automerge doc changed. Need to apply patches to PM doc.');
      }

      return {
        // React to local ProseMirror changes
        update(view, prevState) {
          // Check if document actually changed
          if (view.state.doc.eq(prevState.doc)) return;

          onPMDocChange(view.state.doc);
        },
      };
    },
  });
