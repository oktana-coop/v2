import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

import { noteContentNumbering } from '../../../../../renderer/src/components/editing/inlines';
import { createNoteNumberingTransaction, deleteNote } from './commands';
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
                const link = document.createElement('a');
                link.textContent = `${id}: `;
                link.className = noteContentNumbering;
                link.href = `#note-${id}-ref`;
                link.style.textDecoration = 'none';
                return link;
              },
              { side: -1 }
            );
            decorations.push(deco);
          }
        }
        return DecorationSet.create(state.doc, decorations);
      },
      handleKeyDown(view, event) {
        if (event.key === 'Delete' || event.key === 'Backspace') {
          const { selection, doc } = view.state;
          const { from } = selection;
          const $pos = doc.resolve(from);

          let node = null;
          let nodePos = null;

          if (event.key === 'Backspace' && $pos.nodeBefore) {
            node = $pos.nodeBefore;
            nodePos = from - (node ? node.nodeSize : 1);
          } else if (event.key === 'Delete' && $pos.nodeAfter) {
            node = $pos.nodeAfter;
            nodePos = from;
          }

          if (
            node &&
            nodePos &&
            (node.type.name === 'note_ref' || node.type.name === 'note_content')
          ) {
            return deleteNote(nodePos)(view.state, view.dispatch);
          }

          // Additional logic: if the last node is a text node with just a non-breaking space,
          // and Backspace is pressed at the end, delete the note before it
          const $parent = $pos.parent;
          if (
            event.key === 'Backspace' &&
            $parent.type.name === 'paragraph' &&
            $parent.childCount > 1 &&
            $parent.lastChild &&
            $parent.lastChild.type.name === 'text' &&
            $parent.lastChild.text === '\u00A0' &&
            $pos.pos === $pos.end()
          ) {
            // Find the node before the last (should be the note_ref)
            const beforeLast = $parent.child($parent.childCount - 2);
            if (beforeLast && beforeLast.type.name === 'note_ref') {
              // Calculate its position robustly
              let offset = 0;
              for (let i = 0; i < $parent.childCount - 2; i++) {
                offset += $parent.child(i).nodeSize;
              }
              const noteBeforePos = $pos.start() + offset;
              deleteNote(noteBeforePos)(view.state, view.dispatch);
              // Returning false to also proceed with the default behavior (deleting the trailing space)
              return false;
            }
          }
        }

        return false;
      },
    },
  });
