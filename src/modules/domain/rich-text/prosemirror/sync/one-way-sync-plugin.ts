import { Node } from 'prosemirror-model';
import { Plugin, PluginKey } from 'prosemirror-state';

const pluginKey = new PluginKey('pm-one-way-sync');

type OneWaySyncPluginArgs = {
  onPMDocChange: (doc: Node) => void;
};

export const oneWaySyncPlugin = ({ onPMDocChange }: OneWaySyncPluginArgs) =>
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
