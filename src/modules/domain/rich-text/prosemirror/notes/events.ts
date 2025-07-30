import { EditorView } from 'prosemirror-view';

import { deleteNote, deleteNoteRef } from './commands';

export const handleBackspaceOrDelete = (
  view: EditorView,
  event: KeyboardEvent
): boolean | void => {
  const {
    selection: { from },
    doc,
  } = view.state;
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

  for (let depth = $pos.depth; depth >= 0; depth--) {
    const nodeAtDepth = $pos.node(depth);
    if (nodeAtDepth.type.name === 'note_content') {
      const noteContentPos = $pos.before(depth);

      // Check if the note_content is effectively empty
      const isEmpty =
        nodeAtDepth.content.size === 0 || nodeAtDepth.textContent.trim() === '';

      if (isEmpty) {
        return deleteNote(noteContentPos)(view.state, view.dispatch);
      }

      const isAtStartOfFirstBlockInNoteContent =
        $pos.parentOffset === 0 && $pos.parent === nodeAtDepth.firstChild;

      // Check if the user is deleting the first character of the note_content, in which case the content block
      // will be deleted and the non-empty content will be merged into the previous node.
      // In this case, we also want to delete the corresponding note_ref.
      if (
        $pos.parent.type.name === 'paragraph' &&
        isAtStartOfFirstBlockInNoteContent
      ) {
        const idToDelete = nodeAtDepth.attrs.id;
        deleteNoteRef(idToDelete)(view.state, view.dispatch);
        // Returning false to also proceed with the default behavior (deleting the content block)
        return false;
      }

      break; // Don't keep walking up once we find a note_content
    }
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

  return false;
};
