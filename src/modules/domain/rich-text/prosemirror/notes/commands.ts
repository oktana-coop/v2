import {
  type Command,
  type EditorState,
  TextSelection,
  type Transaction,
} from 'prosemirror-state';

import { getNotes } from './state';

export const createNoteNumberingTransaction = (
  state: EditorState
): Transaction => {
  const { doc } = state;
  let tr = state.tr;
  const { refs, contentBlocks } = getNotes(doc);

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

  return tr;
};

export const numberNotes: Command = (state, dispatch) => {
  const tr = createNoteNumberingTransaction(state);

  if (tr.steps.length) {
    if (dispatch) {
      dispatch(tr);
    }
    return true;
  }

  return false;
};

export const insertNote: Command = (state, dispatch) => {
  const { selection, schema } = state;
  const { from } = selection;

  if (dispatch) {
    const tr = state.tr;
    const ref = schema.nodes.note_ref.create();
    tr.insert(from, ref);

    // Balance notes (this will add the corresponding content block)
    balanceNotes(tr);

    // Move cursor after the note reference
    tr.setSelection(TextSelection.create(tr.doc, from + ref.nodeSize));
    dispatch(tr);
  }

  return true;
};

export const deleteNote = (pos: number): Command => {
  return (state, dispatch) => {
    const node = state.doc.nodeAt(pos);
    if (!node || node.type.name !== 'note_ref') {
      return false;
    }

    if (dispatch) {
      const tr = state.tr;

      // Delete the note reference
      tr.delete(pos, pos + node.nodeSize);

      // Balance notes (this will remove the corresponding content block)
      balanceNotes(tr);

      dispatch(tr);
    }

    return true;
  };
};

export const balanceNotes = (tr: Transaction) => {
  const { refs, contentBlocks } = getNotes(tr.doc);

  // If we have more refs than content blocks, add missing content blocks
  if (refs.length > contentBlocks.length) {
    const missing = refs.length - contentBlocks.length;
    for (let i = 0; i < missing; i++) {
      const placeholderText = tr.doc.type.schema.nodes.paragraph.create(
        {},
        tr.doc.type.schema.text('footnote text')
      );
      const noteContent = tr.doc.type.schema.nodes.note_content.create(
        {},
        placeholderText
      );

      tr.insert(tr.doc.content.size, noteContent);
    }
  }

  // If we have more content blocks than refs, remove excess content blocks from the end
  if (contentBlocks.length > refs.length) {
    const excess = contentBlocks.length - refs.length;
    // Remove from the end, going backwards
    for (
      let i = contentBlocks.length - 1;
      i >= contentBlocks.length - excess;
      i--
    ) {
      const contentBlock = contentBlocks[i];
      tr.delete(
        contentBlock.pos,
        contentBlock.pos + contentBlock.node.nodeSize
      );
    }
  }
};
