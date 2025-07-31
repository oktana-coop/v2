import { type Node, type ResolvedPos } from 'prosemirror-model';
import { type Command } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';

import { deleteCharBeforeCursor } from '../deletion';
import { composeCommands } from '../utils/compose-commands';
import { deleteNote, deleteNoteRef } from './commands';

const getNodeToDelete = ({
  resolvedPos,
  event,
}: {
  resolvedPos: ResolvedPos;
  event: KeyboardEvent;
}): { node: Node; pos: number } | null => {
  if (event.key === 'Backspace' && resolvedPos.nodeBefore) {
    return {
      node: resolvedPos.nodeBefore,
      pos:
        resolvedPos.pos -
        (resolvedPos.nodeBefore ? resolvedPos.nodeBefore.nodeSize : 1),
    };
  }

  if (event.key === 'Delete' && resolvedPos.nodeAfter) {
    return {
      node: resolvedPos.nodeAfter,
      pos: resolvedPos.pos,
    };
  }

  return null;
};

const isNoteRefOrContent = (node: Node): boolean =>
  node.type.name === 'note_ref' || node.type.name === 'note_content';

const findNoteContentBlockAtDepth = ({
  resolvedPos,
  depth,
}: {
  resolvedPos: ResolvedPos;
  depth: number;
}): Node | null => {
  const nodeAtDepth = resolvedPos.node(depth);
  if (nodeAtDepth.type.name === 'note_content') {
    return nodeAtDepth;
  }

  return null;
};

const isNodeEmpty = (node: Node): boolean =>
  node.content.size === 0 || node.textContent.trim() === '';

const isAtStartOfFirstParagraphInNoteContent = ({
  resolvedPos,
  noteContentBlock,
}: {
  resolvedPos: ResolvedPos;
  noteContentBlock: Node;
}): boolean => {
  const isAtStartOfFirstBlockInNoteContent =
    resolvedPos.parentOffset === 0 &&
    resolvedPos.parent === noteContentBlock.firstChild;

  return (
    resolvedPos.parent.type.name === 'paragraph' &&
    isAtStartOfFirstBlockInNoteContent
  );
};

const selectionIsTrailingNonBreakingSpacePrecededByNoteRef = ({
  resolvedPos,
}: {
  resolvedPos: ResolvedPos;
}): boolean => {
  const parentNode = resolvedPos.parent;

  if (
    parentNode.type.name === 'paragraph' &&
    parentNode.childCount > 1 &&
    parentNode.lastChild &&
    parentNode.lastChild.type.name === 'text' &&
    parentNode.lastChild.text === '\u00A0' &&
    resolvedPos.pos === resolvedPos.end()
  ) {
    // Find the node before the last (should be the note_ref)
    const beforeLast = parentNode.child(parentNode.childCount - 2);
    if (beforeLast && beforeLast.type.name === 'note_ref') {
      return true;
    }
  }

  return false;
};

export const handleBackspaceOrDelete = (
  view: EditorView,
  event: KeyboardEvent
): Command | null => {
  const {
    selection: { from },
    doc,
  } = view.state;
  const $pos = doc.resolve(from);

  const nodeToDelete = getNodeToDelete({ resolvedPos: $pos, event });

  if (nodeToDelete && isNoteRefOrContent(nodeToDelete.node)) {
    return deleteNote(nodeToDelete.pos);
  }

  for (let depth = $pos.depth; depth >= 0; depth--) {
    const noteContentBlock = findNoteContentBlockAtDepth({
      resolvedPos: $pos,
      depth,
    });

    if (noteContentBlock) {
      const noteContentPos = $pos.before(depth);

      if (isNodeEmpty(noteContentBlock)) {
        return deleteNote(noteContentPos);
      }

      // Check if the user is deleting the first character of the note_content, in which case the content block
      // will be deleted and the non-empty content will be merged into the previous node.
      // In this case, we also want to delete the corresponding note_ref.
      if (
        isAtStartOfFirstParagraphInNoteContent({
          resolvedPos: $pos,
          noteContentBlock,
        })
      ) {
        const idToDelete = noteContentBlock.attrs.id;
        return deleteNoteRef(idToDelete);
      }

      break; // Don't keep walking up once we find a note_content
    }
  }

  if (
    event.key === 'Backspace' &&
    selectionIsTrailingNonBreakingSpacePrecededByNoteRef({ resolvedPos: $pos })
  ) {
    let offset = 0;
    for (let i = 0; i < $pos.parent.childCount - 2; i++) {
      offset += $pos.parent.child(i).nodeSize;
    }
    const noteBeforePos = $pos.start() + offset;
    return composeCommands([deleteNote(noteBeforePos), deleteCharBeforeCursor]);
  }

  return null;
};
