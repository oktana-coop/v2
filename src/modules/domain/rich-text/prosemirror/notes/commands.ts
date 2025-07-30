import { type Node, type Schema } from 'prosemirror-model';
import {
  type Command,
  type EditorState,
  TextSelection,
  type Transaction,
} from 'prosemirror-state';

import { getNotes, type NodeWithPos } from './state';

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

const findNoteRefInsertIndex = ({
  refs,
  selectionStart,
}: {
  refs: Array<NodeWithPos>;
  selectionStart: number;
}): number => {
  const insertIndex = refs.findIndex((ref) => ref.pos >= selectionStart);

  if (insertIndex !== -1) {
    return insertIndex;
  }

  return refs.length;
};

const findNoteContentBlockInsertIndex = ({
  contentBlocks,
  newNoteIndex,
  doc,
}: {
  contentBlocks: Array<NodeWithPos>;
  newNoteIndex: number;
  doc: Node;
}): number => {
  if (contentBlocks.length > 0) {
    if (newNoteIndex === 0) {
      // Insert before the first content block
      return contentBlocks[0].pos;
    } else {
      // Insert after the previous content block
      const prevContent = contentBlocks[newNoteIndex - 1];
      return prevContent.pos + prevContent.node.nodeSize;
    }
  }

  // default to end of the document
  return doc.content.size;
};

const createNoteBlockWithPlaceholder =
  (placeholderText: string) =>
  (schema: Schema) =>
  ({ noteId, doc }: { noteId: number; doc: Node }): Node => {
    const contentParagraph = schema.nodes.paragraph.create(
      {},
      schema.text(placeholderText)
    );

    const noteContent = doc.type.schema.nodes.note_content.create(
      {
        id: noteId,
      },
      contentParagraph
    );

    return noteContent;
  };

export const insertNote: Command = (state, dispatch) => {
  const {
    selection: { from },
    schema,
    doc,
  } = state;
  const { refs } = getNotes(doc);

  const insertIndex = findNoteRefInsertIndex({
    refs,
    selectionStart: from,
  });

  // The new id will be insertIndex + 1 (since notes are 1-based)
  const newId = insertIndex + 1;

  if (dispatch) {
    const tr = state.tr;

    // Insert the note_ref at the cursor
    const refNode = schema.nodes.note_ref.create({ id: newId });
    tr.insert(from, refNode);

    // Insert a non-breaking space after the note_ref. This results in a better user experience
    // as it allows the user to continue typing and avoids ProseMirror rendering separator elements.
    tr.insertText('\u00A0', from + refNode.nodeSize);

    const { contentBlocks } = getNotes(tr.doc);
    const contentBlockInsertPos = findNoteContentBlockInsertIndex({
      contentBlocks,
      newNoteIndex: insertIndex,
      doc: tr.doc,
    });

    const noteContent = createNoteBlockWithPlaceholder('footnote text')(schema)(
      {
        noteId: newId,
        doc: tr.doc,
      }
    );

    tr.insert(contentBlockInsertPos, noteContent);

    // Move cursor after the space that follows the note ref
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
