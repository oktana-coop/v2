import { Node } from 'prosemirror-model';
import { Plugin, PluginKey } from 'prosemirror-state';

const pluginKey = new PluginKey('pm-sync');

type SyncPluginArgs = {
  onPMDocChange: (doc: Node) => void;
};

export const syncPlugin = ({ onPMDocChange }: SyncPluginArgs) =>
  new Plugin({
    key: pluginKey,
    view() {
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
