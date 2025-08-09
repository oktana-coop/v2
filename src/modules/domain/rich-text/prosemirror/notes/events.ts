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

type NodeWithPos = { pos: number; node: Node };

export const getNoteNodesFullyIncludedInSelection = (
  state: EditorState
): {
  refsWithoutContent: { ref: NodeWithPos; contentBlock: NodeWithPos }[];
  contentBlocksWithoutRef: { ref: NodeWithPos; contentBlock: NodeWithPos }[];
} => {
  const { from, to } = state.selection;
  const { refs, contentBlocks } = getNotes(state.doc);

  const selectedRefMap = new Map(
    refs
      .filter(({ pos, node }) => from <= pos && to >= pos + node.nodeSize)
      .map(({ pos, node }) => [String(node.attrs.id), { pos, node }])
  );

  const selectedContentMap = new Map(
    contentBlocks
      .filter(({ pos, node }) => from <= pos && to >= pos + node.content.size)
      .map(({ pos, node }) => [String(node.attrs.id), { pos, node }])
  );

  const allNoteIds = new Set([
    ...refs.map(({ node }) => String(node.attrs.id)),
    ...contentBlocks.map(({ node }) => String(node.attrs.id)),
  ]);

  const refMap = new Map(
    refs.map(({ pos, node }) => [String(node.attrs.id), { pos, node }])
  );

  const contentMap = new Map(
    contentBlocks.map(({ pos, node }) => [String(node.attrs.id), { pos, node }])
  );

  const refsWithoutContent = Array.from(allNoteIds)
    .filter((id) => selectedRefMap.has(id) && !selectedContentMap.has(id))
    .map((id) => ({
      ref: selectedRefMap.get(id)!,
      contentBlock: contentMap.get(id)!,
    }));

  const contentBlocksWithoutRef = Array.from(allNoteIds)
    .filter((id) => selectedContentMap.has(id) && !selectedRefMap.has(id))
    .map((id) => ({
      ref: refMap.get(id)!,
      contentBlock: selectedContentMap.get(id)!,
    }));

  return {
    refsWithoutContent,
    contentBlocksWithoutRef,
  };
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

  // Handle potentially fully selected note content blocks or refs getting deleted,
  // with their counterparts not included in the selection.
  // In this case, we also want to delete the corresponding note_ref or content block.
  if (!view.state.selection.empty) {
    const { contentBlocksWithoutRef, refsWithoutContent } =
      getNoteNodesFullyIncludedInSelection(view.state);

    if (refsWithoutContent.length > 0 || contentBlocksWithoutRef.length > 0) {
      return composeCommands([
        ...refsWithoutContent
          .map(({ ref }) => ref)
          .sort((a, b) => b.pos - a.pos)
          .map((ref) => deleteNote(ref.pos)),
        ...contentBlocksWithoutRef
          .map(({ ref }) => ref)
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
