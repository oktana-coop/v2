import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

import { noteContentNumbering } from '../../../../../renderer/src/components/editing/inlines';
import { createNoteNumberingTransaction } from './commands';
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

      const tr = createNoteNumberingTransaction(newState);
      return tr.steps.length ? tr : null;
    },
    props: {
      decorations(state) {
        const { contentBlocks } = getNotes(state.doc);
        const decorations = [];

        for (let i = 0; i < contentBlocks.length; i++) {
          const content = contentBlocks[i];
          const id = content.node.attrs.id;

          if (id) {
            const deco = Decoration.widget(
              // +2 to be before the content of the first paragraph of the note (which is a div itself)
              content.pos + 2,
              () => {
                const span = document.createElement('span');
                span.textContent = `${id}: `;
                span.className = noteContentNumbering;
                span.style.userSelect = 'none';
                span.style.pointerEvents = 'none';
                return span;
              },
              { side: -1 }
            );
            decorations.push(deco);
          }
        }
        return DecorationSet.create(state.doc, decorations);
      },
    },
  });
