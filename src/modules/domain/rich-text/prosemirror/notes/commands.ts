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

export const ensureTrailingSpaceAfterContentBlockNumbers = (
  tr: Transaction
): Transaction => {
  const { contentBlocks } = getNotes(tr.doc);

  contentBlocks.forEach(({ node, pos }) => {
    const isEmpty = node.textContent.trim() === '';
    if (isEmpty) {
      const firstPara = node.firstChild;
      if (
        firstPara &&
        firstPara.type.name === 'paragraph' &&
        firstPara.childCount === 0
      ) {
        const insertPos = pos + 2; // pos + 1 = open tag of note_content, +1 = open tag of paragraph
        tr.insertText(' ', insertPos);
      }
    }
  });

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
  const { selection, schema, doc } = state;
  const { from } = selection;
  const { refs } = getNotes(doc);

  // Find the index where the new ref will be inserted
  let insertIndex = refs.findIndex((ref) => ref.pos >= from);
  if (insertIndex === -1) insertIndex = refs.length;

  // The new id will be insertIndex + 1 (since notes are 1-based)
  const newId = insertIndex + 1;

  if (dispatch) {
    const tr = state.tr;

    // Insert the note_ref at the cursor
    const refNode = schema.nodes.note_ref.create({ id: newId });
    tr.insert(from, refNode);

    // Insert a space after the note_ref
    tr.insertText('\u00A0', from + refNode.nodeSize);

    const { contentBlocks } = getNotes(tr.doc);

    // Find the position to insert the content block
    let contentInsertPos = tr.doc.content.size; // default to end
    if (contentBlocks.length > 0) {
      if (insertIndex === 0) {
        // Insert before the first content block
        contentInsertPos = contentBlocks[0].pos;
      } else {
        // Insert after the previous content block
        const prevContent = contentBlocks[insertIndex - 1];
        contentInsertPos = prevContent.pos + prevContent.node.nodeSize;
      }
    }

    // Insert the note_content block
    const placeholderText = tr.doc.type.schema.nodes.paragraph.create(
      {},
      tr.doc.type.schema.text('footnote text')
    );
    const noteContent = tr.doc.type.schema.nodes.note_content.create(
      {
        id: newId,
      },
      placeholderText
    );

    tr.insert(contentInsertPos, noteContent);

    // Move cursor after the space
    tr.setSelection(TextSelection.create(tr.doc, from + refNode.nodeSize + 1));
    dispatch(tr);
  }

  return true;
};

export const deleteNote = (pos: number): Command => {
  return (state, dispatch) => {
    const { doc } = state;
    const node = doc.nodeAt(pos);
    if (!node) return false;

    const { refs, contentBlocks } = getNotes(doc);

    if (node.type.name === 'note_ref') {
      const id = node.attrs.id;
      const content = contentBlocks.find((c) => c.node.attrs.id === id);

      if (dispatch) {
        const tr = state.tr;
        if (content) {
          // Delete the node with the higher position first to avoid shifting
          if (content.pos > pos) {
            tr.delete(content.pos, content.pos + content.node.nodeSize).delete(
              pos,
              pos + node.nodeSize
            );
          } else {
            tr.delete(pos, pos + node.nodeSize).delete(
              content.pos,
              content.pos + content.node.nodeSize
            );
          }
        } else {
          tr.delete(pos, pos + node.nodeSize);
        }
        dispatch(tr);
      }
      return true;
    }

    if (node.type.name === 'note_content') {
      const id = node.attrs.id;
      const ref = refs.find((r) => r.node.attrs.id === id);

      if (dispatch) {
        const tr = state.tr;

        // Delete the node with the higher position first to avoid shifting
        if (ref) {
          if (ref.pos > pos) {
            tr.delete(ref.pos, ref.pos + ref.node.nodeSize).delete(
              pos,
              pos + node.nodeSize
            );
          } else {
            tr.delete(pos, pos + node.nodeSize).delete(
              ref.pos,
              ref.pos + ref.node.nodeSize
            );
          }
        } else {
          tr.delete(pos, pos + node.nodeSize);
        }

        dispatch(tr);
      }
      return true;
    }

    return false;
  };
};

export const deleteNoteRef = (id: string): Command => {
  return (state, dispatch) => {
    const { refs } = getNotes(state.doc);
    const ref = refs.find((r) => r.node.attrs.id === id);

    if (ref) {
      if (dispatch) {
        const tr = state.tr;

        tr.delete(ref.pos, ref.pos + ref.node.nodeSize).delete(
          ref.pos,
          ref.pos + ref.node.nodeSize
        );

        dispatch(tr);
      }

      return true;
    }

    return false;
  };
};
