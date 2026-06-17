import { type Node, type Schema } from 'prosemirror-model';
import {
  type Command,
  type EditorState,
  NodeSelection,
  Plugin,
  type Selection,
  TextSelection,
} from 'prosemirror-state';
import { type EditorView } from 'prosemirror-view';

import { type DocumentAsset } from '../../models';
import { transactionsMayHaveRemovedContent } from '../transactions';

// Backspace at the start of a textblock immediately after a figure deletes the figure.
export const deleteFigureBeforeCursor: Command = (state, dispatch) => {
  const { $from, empty } = state.selection;
  if (!empty || $from.parentOffset !== 0) return false;

  const nodeBefore = state.doc.resolve($from.before()).nodeBefore;
  if (!nodeBefore || nodeBefore.type.name !== 'figure') return false;

  if (dispatch) {
    const figureNodeEnd = $from.before();

    dispatch(
      state.tr
        .delete(figureNodeEnd - nodeBefore.nodeSize, figureNodeEnd)
        .scrollIntoView()
    );
  }

  return true;
};

// Delete at the end of a textblock immediately before a figure removes the figure.
export const deleteFigureAfterCursor: Command = (state, dispatch) => {
  const { $from, empty } = state.selection;
  if (!empty || $from.parentOffset !== $from.parent.content.size) return false;

  const nodeAfter = state.doc.resolve($from.after()).nodeAfter;
  if (!nodeAfter || nodeAfter.type.name !== 'figure') return false;

  if (dispatch) {
    const figureNodeStart = $from.after();
    dispatch(
      state.tr
        .delete(figureNodeStart, figureNodeStart + nodeAfter.nodeSize)
        .scrollIntoView()
    );
  }
  return true;
};

const isFigureContentEmpty = ({
  figure,
  schema,
}: {
  figure: Node;
  schema: Schema;
}): boolean => {
  const figureFirstChild = figure.firstChild;

  return (
    !figureFirstChild ||
    figureFirstChild.type !== schema.nodes.figure_content ||
    figureFirstChild.childCount === 0
  );
};

const findEmptyFigureRanges = ({
  doc,
  schema,
}: {
  doc: Node;
  schema: Schema;
}): Array<{ from: number; to: number }> => {
  const emptyFigureRanges: Array<{ from: number; to: number }> = [];
  doc.descendants((node, pos) => {
    if (node.type !== schema.nodes.figure) return true;
    if (isFigureContentEmpty({ figure: node, schema })) {
      emptyFigureRanges.push({ from: pos, to: pos + node.nodeSize });
    }
    // Don't descend into figures.
    return false;
  });
  return emptyFigureRanges;
};

/**
 * Drops figures whose body has no image after a transaction. Deleting an image
 * inside a figure leaves the `figure_content` node empty, leaving dangling markup/content
 * in the document. Cleaning them up here keeps deletion behavior intuitive.
 */
export const removeEmptyFiguresPlugin = (schema: Schema) =>
  new Plugin({
    appendTransaction(transactions, _, newState) {
      if (!transactionsMayHaveRemovedContent({ transactions })) return null;

      const emptyFigures = findEmptyFigureRanges({ doc: newState.doc, schema });
      if (emptyFigures.length === 0) return null;

      // Delete back-to-front: each range is an offset into the original doc,
      // so removing a later figure first leaves earlier offsets undisturbed.
      const tr = newState.tr;
      for (let i = emptyFigures.length - 1; i >= 0; i--) {
        tr.delete(emptyFigures[i].from, emptyFigures[i].to);
      }
      return tr;
    },
  });

// The figure a selection points at, whether the figure node itself is
// selected or the selection sits somewhere inside it. Returns null when no
// figure is in scope.
const findSelectedFigure = ({
  selection,
}: {
  selection: Selection;
}): { pos: number; size: number } | null => {
  if (!(selection instanceof NodeSelection)) return null;

  if (selection.node.type.name === 'figure') {
    return { pos: selection.from, size: selection.node.nodeSize };
  }

  const { $from } = selection;
  for (let depth = $from.depth; depth >= 0; depth--) {
    const node = $from.node(depth);
    if (node.type.name === 'figure') {
      return { pos: $from.before(depth), size: node.nodeSize };
    }
  }
  return null;
};

// Enter while a figure is selected should drop the cursor into a paragraph
// immediately below the figure. If a paragraph already lives there we just
// move the cursor to it; otherwise we insert a new empty paragraph.
export const moveToParagraphAfterSelectedFigure: Command = (
  state,
  dispatch
) => {
  const selectedFigure = findSelectedFigure({ selection: state.selection });
  if (!selectedFigure) return false;

  if (dispatch) {
    const afterFigure = selectedFigure.pos + selectedFigure.size;
    const nodeAfter = state.doc.resolve(afterFigure).nodeAfter;
    const insertNewParagraph =
      !nodeAfter || nodeAfter.type.name !== 'paragraph';

    const tr = insertNewParagraph
      ? state.tr.insert(afterFigure, state.schema.nodes.paragraph.create())
      : state.tr;

    dispatch(
      tr
        .setSelection(TextSelection.create(tr.doc, afterFigure + 1))
        .scrollIntoView()
    );
  }
  return true;
};

export const canInsertFigure = (state: EditorState): boolean => {
  const { $from, empty } = state.selection;
  return (
    empty &&
    $from.parent.type.name === 'paragraph' &&
    $from.parent.content.size === 0
  );
};

export type InsertFigureArgs = {
  src: string;
  alt?: string | null;
  title?: string | null;
};

export const insertFigure =
  ({ src, alt = null, title = null }: InsertFigureArgs): Command =>
  (state, dispatch) => {
    if (!canInsertFigure(state)) {
      return false;
    }

    const { figure, figure_content, image } = state.schema.nodes;
    if (!figure || !figure_content || !image) {
      return false;
    }

    if (dispatch) {
      const { $from } = state.selection;
      const insertPos = $from.before();

      const imageNode = image.create({ src, alt, title });
      const figureContentNode = figure_content.create(null, imageNode);
      const figureNode = figure.create(null, figureContentNode);

      const tr = state.tr
        .replaceRangeWith($from.before(), $from.after(), figureNode)
        .scrollIntoView();

      tr.setSelection(NodeSelection.create(tr.doc, insertPos));
      dispatch(tr);
    }

    return true;
  };

// Async asset picker the caller supplies. Returns `null` when the user cancels.
export type FigureAssetPicker = () => Promise<DocumentAsset | null>;

export const pickAndInsertFigure =
  (pickAsset: FigureAssetPicker) =>
  async (view: EditorView): Promise<boolean> => {
    // Snapshot `canInsertFigure` before awaiting — if the selection moves
    // during the picker, we still won't insert into an invalid position
    // because `insertFigure` re-checks at dispatch time.
    if (!canInsertFigure(view.state)) return false;

    const picked = await pickAsset();
    if (!picked) return false;

    return insertFigure(picked)(view.state, view.dispatch);
  };
