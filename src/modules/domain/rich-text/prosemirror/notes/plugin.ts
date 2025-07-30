import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

import { noteContentNumbering } from '../../../../../renderer/src/components/editing/inlines';
import {
  createNoteNumberingTransaction,
  deleteNote,
  deleteNoteRef,
  ensureTrailingSpaceAfterContentBlockNumbers,
} from './commands';
import { handleBackspaceOrDelete } from './events';
import { getNotes } from './state';

const pluginKey = new PluginKey('note-numbering');

export const notesPlugin = () =>
  new Plugin({
    key: pluginKey,
    state: {
      init: () => ({}),
      apply(_, prev) {
        // This plugin is stateless, so we just return the previous state
        return prev;
      },
    },
    appendTransaction(transactions, _, newState) {
      const hasDocChanges = transactions.some((tr) => tr.docChanged);
      if (!hasDocChanges) return null;

      const tr = ensureTrailingSpaceAfterContentBlockNumbers(
        createNoteNumberingTransaction(newState)
      );

      return tr.steps.length ? tr : null;
    },
    props: {
      decorations(state) {
        const { contentBlocks } = getNotes(state.doc);

        const backlinkDecorations = contentBlocks
          .filter((content) => Boolean(content.node.attrs.id))
          .map((content) => {
            const id = content.node.attrs.id as string;
            return createBacklinkDecoration(
              id,
              // +2 to be before the content of the first paragraph of the note (which is a div itself)
              content.pos + 2
            );
          });

        return DecorationSet.create(state.doc, backlinkDecorations);
      },
      handleKeyDown(view, event) {
        if (event.key === 'Delete' || event.key === 'Backspace') {
          return handleBackspaceOrDelete(view, event);
        }

        return false;
      },
    },
  });

const createBacklinkDecoration = (id: string, pos: number) =>
  Decoration.widget(
    pos,
    () => {
      const link = document.createElement('a');
      link.textContent = `${id}:\u00A0`;
      link.className = noteContentNumbering;
      link.href = `#note-${id}-ref`;
      link.style.textDecoration = 'none';
      return link;
    },
    { side: -1 }
  );
