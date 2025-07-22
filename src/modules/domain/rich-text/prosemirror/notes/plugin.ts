import { Plugin, PluginKey } from 'prosemirror-state';

import { getNotes } from './state';

const pluginKey = new PluginKey('note-numbering');

export const notesPlugin = () =>
  new Plugin({
    key: pluginKey,
    state: {
      init: () => ({}),
      apply(_, prev) {
        return prev; // stateless
      },
    },
    appendTransaction(transactions, _, newState) {
      const hasDocChanges = transactions.some((tr) => tr.docChanged);
      if (!hasDocChanges) return null;

      let tr = newState.tr;
      const { refs, contentBlocks } = getNotes(newState.doc);

      // Renumber refs and contents by index
      for (let i = 0; i < Math.min(refs.length, contentBlocks.length); i++) {
        const ref = refs[i];
        const content = contentBlocks[i];
        const id = i + 1;

        if (ref.node.attrs.id !== id) {
          tr = tr.setNodeMarkup(ref.pos, undefined, {
            ...ref.node.attrs,
            id,
          });
        }

        if (content.node.attrs.id !== id) {
          tr = tr.setNodeMarkup(content.pos, undefined, {
            ...content.node.attrs,
            id,
          });
        }
      }

      return tr.steps.length ? tr : null;
    },
  });
