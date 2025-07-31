import { baseKeymap } from 'prosemirror-commands';
import { type Node, type ResolvedPos } from 'prosemirror-model';
import {
  type Command,
  type EditorState,
  type Selection,
} from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';

import { deleteCharBeforeCursor } from '../deletion';
import { composeCommands } from '../utils/compose-commands';
import { deleteNote, deleteNoteRef } from './commands';
import { getNotes } from './state';

const defaultBackspace = baseKeymap.Backspace;
const defaultDelete = baseKeymap.Delete;

const getFullySelectedNoteContentBlocksAndRefs = (state: EditorState) => {
  const { from, to } = state.selection;
  const { refs, contentBlocks } = getNotes(state.doc);

  const fullySelectedContentBlocks = contentBlocks.filter(({ pos, node }) => {
    const nodeStart = pos;
    const nodeEnd = pos + node.content.size;
    return from <= nodeStart && to >= nodeEnd;
  });

  const correspondingRefs = refs.filter((ref) =>
    fullySelectedContentBlocks.some(
      (block) => block.node.attrs.id === ref.node.attrs.id
    )
  );

  return { contentBlocks: fullySelectedContentBlocks, refs: correspondingRefs };
};

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

const cursorIsAtStartOfFirstParagraphInNoteContent = ({
  resolvedPos,
  noteContentBlock,
  selection,
}: {
  resolvedPos: ResolvedPos;
  noteContentBlock: Node;
  selection: Selection;
}): boolean => {
  const cursorIsAtStartOfFirstBlockInNoteContent =
    selection.empty &&
    resolvedPos.parentOffset === 0 &&
    resolvedPos.parent === noteContentBlock.firstChild;

  return (
    resolvedPos.parent.type.name === 'paragraph' &&
    cursorIsAtStartOfFirstBlockInNoteContent
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
): Command => {
  const defaultCommand =
    event.key === 'Backspace' ? defaultBackspace : defaultDelete;

  const {
    selection: { from },
    doc,
  } = view.state;

  // Handle potentially fully selected note content blocks getting deleted.
  // In this case, we delete the note refs as well.
  if (!view.state.selection.empty) {
    const { contentBlocks: fullySelectedContentBlocks, refs: refsToDelete } =
      getFullySelectedNoteContentBlocksAndRefs(view.state);

    if (fullySelectedContentBlocks.length > 0) {
      return composeCommands([
        ...refsToDelete
          .sort((a, b) => b.pos - a.pos)
          .map((ref) => deleteNoteRef(ref.node.attrs.id)),
        defaultCommand,
      ]);
    }
  }

  // Then, we handle the case where the user is deleting a single note ref or content block.
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
        cursorIsAtStartOfFirstParagraphInNoteContent({
          resolvedPos: $pos,
          noteContentBlock,
          selection: view.state.selection,
        })
      ) {
        const idToDelete = noteContentBlock.attrs.id;
        return composeCommands([deleteNoteRef(idToDelete), defaultCommand]);
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

  return defaultCommand;
};
