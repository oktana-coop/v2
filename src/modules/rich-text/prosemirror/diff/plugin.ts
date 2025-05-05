import { Plugin, PluginKey } from 'prosemirror-state';
import { DecorationSet } from 'prosemirror-view';

export const diffPluginKey = new PluginKey('pm-diff');

type DiffPluginArgs = {
  decorations: DecorationSet;
};

export const diffPlugin = (args: DiffPluginArgs) =>
  new Plugin({
    key: diffPluginKey,
    state: {
      init: () => {
        return args.decorations;
      },
      apply: () => {
        return args.decorations;
      },
    },
    props: {
      decorations(state) {
        // The plugin's state just contains the decorations
        return diffPluginKey.getState(state);
      },
    },
  });
