import { Plugin, PluginKey } from 'prosemirror-state';

import { createNoteNumberingTransaction } from './commands';

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

      const tr = createNoteNumberingTransaction(newState);
      return tr.steps.length ? tr : null;
    },
  });
