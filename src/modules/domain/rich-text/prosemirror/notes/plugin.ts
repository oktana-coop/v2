import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet, EditorView } from 'prosemirror-view';

import { noteRef as noteRefClasses } from '../../../../../renderer/src/components/editing/inlines';
import { balanceNotes, deleteNote } from './commands';
import { getNoteContentBlocks, getNoteRefs } from './state';

const pluginKey = new PluginKey('note-numbering');

export const notesPlugin = () =>
  new Plugin({
    key: pluginKey,
    state: {
      init() {
        return DecorationSet.empty;
      },
      apply(tr, _, __, newState) {
        // Update footnote numbering when document changes
        if (tr.docChanged) {
          const refs = getNoteRefs(newState.doc);
          const contentBlocks = getNoteContentBlocks(newState.doc);

          if (refs.length !== contentBlocks.length) {
            // Schedule balancing on next tick to avoid infinite loops
            setTimeout(() => {
              const currentRefs = getNoteRefs(newState.doc);
              const currentContentBlocks = getNoteContentBlocks(newState.doc);

              if (currentRefs.length !== currentContentBlocks.length) {
                const balanceTr = newState.tr;
                balanceNotes(balanceTr);
                if (balanceTr.docChanged) {
                  const view = this.view;
                  if (view) {
                    view.dispatch(balanceTr);
                  }
                }
              }
            }, 0);
          }
        }

        // Add decorations for footnote references
        const decorations: Decoration[] = [];

        newState.doc.descendants((node, pos) => {
          if (node.type.name === 'note_ref') {
            const decoration = Decoration.node(pos, pos + node.nodeSize, {
              class: noteRefClasses,
            });
            decorations.push(decoration);
          }
        });

        return DecorationSet.create(newState.doc, decorations);
      },
    },
    props: {
      decorations(state) {
        // The plugin's state just contains the decorations
        return pluginKey.getState(state);
      },

      handleClick(view, pos) {
        const node = view.state.doc.nodeAt(pos);

        // Handle clicks on footnote references - scroll to corresponding content block
        if (node && node.type.name === 'note_ref') {
          const refs = getNoteRefs(view.state.doc);
          const refIndex = refs.findIndex((ref) => ref.pos === pos);

          if (refIndex >= 0) {
            const contentBlocks = getNoteContentBlocks(view.state.doc);
            if (contentBlocks[refIndex]) {
              // Find the DOM element and scroll to it
              const contentBlockElements =
                view.dom.querySelectorAll('.note-content');
              const contentBlockElement = contentBlockElements[refIndex];

              if (contentBlockElement) {
                contentBlockElement.scrollIntoView({ behavior: 'smooth' });
              }
            }
          }
          return true;
        }

        return false;
      },

      handleKeyDown(view, event) {
        if (event.key === 'Delete' || event.key === 'Backspace') {
          const { selection } = view.state;
          const { from } = selection;

          let nodePos = from;
          if (event.key === 'Backspace') {
            nodePos = from - 1;
          }

          const node = view.state.doc.nodeAt(nodePos);
          if (node && node.type.name === 'note_ref') {
            deleteNote(nodePos)(view.state, view.dispatch);
            return true;
          }
        }

        return false;
      },
    },
  });
