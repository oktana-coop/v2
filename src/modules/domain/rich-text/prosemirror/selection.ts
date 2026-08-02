import {
  Fragment,
  type MarkType,
  type Node as ProseMirrorNode,
} from 'prosemirror-model';
import {
  EditorState,
  Plugin,
  Selection,
  TextSelection,
} from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';

import {
  blockTypes,
  type ContainerBlockType,
  type LeafBlockType,
} from '../constants/blocks';
import { getLinkAttrsFromDomElement, type LinkAttrs } from '../models/link';
import { findMarkBoundaries } from './marks';

export const getCurrentLeafBlockType = (
  state: EditorState
): LeafBlockType | null => {
  const { $from } = state.selection;

  switch ($from.node().type.name) {
    case 'paragraph':
      return blockTypes.PARAGRAPH;
    case 'heading':
      switch ($from.node().attrs.level) {
        case 1:
        default:
          return blockTypes.HEADING_1;
        case 2:
          return blockTypes.HEADING_2;
        case 3:
          return blockTypes.HEADING_3;
        case 4:
          return blockTypes.HEADING_4;
        case 5:
          return blockTypes.HEADING_5;
        case 6:
          return blockTypes.HEADING_6;
      }
    case 'code_block':
      return blockTypes.CODE_BLOCK;
    default:
      return null;
  }
};

export const getCurrentContainerBlockType = (
  state: EditorState
): ContainerBlockType | null => {
  const { $from } = state.selection;

  const findContainerBlockType = (depth: number): ContainerBlockType | null => {
    if (depth < 0) return null; // Base case: No more levels to check

    const node = $from.node(depth);

    switch (node.type.name) {
      case 'bullet_list':
        return blockTypes.BULLET_LIST;
      case 'ordered_list':
        return blockTypes.ORDERED_LIST;
      case 'blockquote':
        return blockTypes.BLOCKQUOTE;
      default:
        return findContainerBlockType(depth - 1); // Recursive case
    }
  };

  return findContainerBlockType($from.depth);
};

export const isMarkActive =
  (markType: MarkType) =>
  (state: EditorState): boolean => {
    const { from, to, empty, $cursor } = state.selection as TextSelection;

    if (empty && $cursor) {
      return Boolean(markType.isInSet(state.storedMarks || $cursor.marks()));
    } else {
      return state.doc.rangeHasMark(from, to, markType);
    }
  };

export const getSelectedText = (state: EditorState): string | null => {
  const { selection } = state;

  // Check if the selection is a text selection and not a node selection
  if (!(selection instanceof TextSelection)) {
    return null;
  }

  // Check if the selection is a cursor (i.e., no range)
  if (selection.empty) {
    return null;
  }

  // Check if the selection spans multiple blocks
  const { $from, $to } = selection;
  if ($from.blockRange($to) === null) {
    return null;
  }

  return state.doc.textBetween(selection.from, selection.to);
};

// Last resort for selections whose structure cannot be closed into a valid
// document: just the selected text, one paragraph per block.
const plainTextDocFromSelection = (
  state: EditorState,
  from: number,
  to: number
): ProseMirrorNode => {
  const { schema } = state;
  const paragraphs = state.doc
    .textBetween(from, to, '\n')
    .split('\n')
    .map((line) =>
      schema.nodes.paragraph.create(null, line ? [schema.text(line)] : null)
    );

  return state.doc.type.create(null, Fragment.from(paragraphs));
};

// Builds the smallest valid standalone document that contains the current
// selection, keeping only the structural context the content cannot stand
// without: list items keep their list (and its type), a partial heading or
// code block keeps its block, but e.g. a blockquote around fully selected
// paragraphs is dropped. Returns null when the selection is empty.
export const docFromSelection = (
  state: EditorState
): ProseMirrorNode | null => {
  const { selection, doc } = state;

  if (selection.empty) {
    return null;
  }

  const { $from, from, to } = selection;
  const docType = doc.type;

  // Cut the selected range out of the deepest node that contains all of it.
  const sharedDepth = $from.sharedDepth(to);
  const contentStart = $from.start(sharedDepth);
  let fragment = $from
    .node(sharedDepth)
    .content.cut(from - contentStart, to - contentStart);

  // Wrap the fragment in copies of its ancestors until it is valid top-level
  // document content. createAndFill patches up boundary nodes that the cut
  // left without their required children.
  let depth = sharedDepth;
  while (depth > 0 && !docType.validContent(fragment)) {
    const ancestor = $from.node(depth);
    const wrapped = ancestor.type.createAndFill(ancestor.attrs, fragment);

    if (!wrapped) {
      break;
    }

    fragment = Fragment.from(wrapped);
    depth -= 1;
  }

  if (docType.validContent(fragment)) {
    // Deliberately not carrying over the source doc's attrs (pandocMeta):
    // copying a selection should not drag document metadata along.
    const candidate = docType.create(null, fragment);

    try {
      candidate.check();
      return candidate;
    } catch {
      // Fall through to the plain-text fallback below.
    }
  }

  return plainTextDocFromSelection(state, from, to);
};

export const findLinkAtSelection = ({
  view,
  selection,
}: {
  view: EditorView;
  selection: Selection;
}): { element: HTMLElement; linkAttrs: LinkAttrs } | null => {
  const domAtPos = view.domAtPos(selection.from, 1);

  const findLinkElement = (
    node: Node
  ): { element: HTMLElement; linkAttrs: LinkAttrs } | null => {
    // Ensure the node exists and is a valid DOM element
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return null;

    // Base case: If the node is an <a> element, return it
    if (node instanceof HTMLElement && node.tagName === 'A') {
      const linkAttrs = getLinkAttrsFromDomElement(node);
      return { element: node, linkAttrs };
    }

    // Recursive case: Check the parent node if it exists
    return node.parentNode ? findLinkElement(node.parentNode) : null;
  };

  const initialNode =
    domAtPos.node.nodeType === Node.TEXT_NODE
      ? domAtPos.node.parentNode // Start with the parent of a text node
      : domAtPos.node; // Or use the node directly if it's not a text node

  return initialNode ? findLinkElement(initialNode) : null;
};

export const linkSelectionPlugin = new Plugin({
  props: {
    handleClick: (view, pos) => {
      const { state } = view;
      const { schema, doc } = state;
      const linkMark = schema.marks.link;

      const resolvedPosition = doc.resolve(pos);
      const positionMarks = resolvedPosition.marks();

      const positionHasLink = positionMarks.some(
        (mark) => mark.type === linkMark
      );

      if (positionHasLink) {
        const [start, end] = findMarkBoundaries(linkMark)({ pos, doc });
        const tr = state.tr.setSelection(TextSelection.create(doc, start, end));
        view.dispatch(tr);

        return true;
      }

      return false;
    },
  },
});

export const selectionChangePlugin = (
  onSelectionChange: (selection: Selection, view: EditorView) => void
) =>
  new Plugin({
    view() {
      return {
        update(view, prevState) {
          const { state } = view;
          const { selection } = state;

          // Detect if the selection has changed
          if (
            !(
              prevState &&
              prevState.doc.eq(state.doc) &&
              selection.eq(prevState.selection)
            )
          ) {
            onSelectionChange(selection, view);
          }
        },
      };
    },
  });
