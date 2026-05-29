import {
  type Command,
  type EditorState,
  NodeSelection,
  Plugin,
  PluginKey,
  TextSelection,
} from 'prosemirror-state';
import { type EditorView } from 'prosemirror-view';

// Backspace at the start of a textblock immediately after a figure deletes
// the figure on the first press. PM's default `joinBackward`/`selectNodeBackward`
// chain doesn't behave well here: it tries to land the cursor inside
// `figure_content`, which is `atom: true` and refuses, then the
// trailing-paragraph plugin reinstates the structure — net effect, two
// keypresses are wasted before the third actually deletes the figure.
export const deleteFigureBeforeCursor: Command = (state, dispatch) => {
  const { $from, empty } = state.selection;
  if (!empty || $from.parentOffset !== 0) return false;

  const before = state.doc.resolve($from.before()).nodeBefore;
  if (!before || before.type.name !== 'figure') return false;

  if (dispatch) {
    const figureEnd = $from.before();
    dispatch(
      state.tr.delete(figureEnd - before.nodeSize, figureEnd).scrollIntoView()
    );
  }
  return true;
};

// Symmetric: Delete at the end of a textblock immediately before a figure
// removes the figure.
export const deleteFigureAfterCursor: Command = (state, dispatch) => {
  const { $from, empty } = state.selection;
  if (!empty || $from.parentOffset !== $from.parent.content.size) return false;

  const after = state.doc.resolve($from.after()).nodeAfter;
  if (!after || after.type.name !== 'figure') return false;

  if (dispatch) {
    const figureStart = $from.after();
    dispatch(
      state.tr
        .delete(figureStart, figureStart + after.nodeSize)
        .scrollIntoView()
    );
  }
  return true;
};

// Enter while a figure (or anything inside it) is NodeSelection-selected
// drops the cursor into a paragraph immediately below the figure. If a
// paragraph already lives there — the typical case, since the
// trailing-paragraph plugin/helper ensures one — we just move the cursor
// to it; otherwise we insert a new empty paragraph.
export const createParagraphAfterSelectedFigure: Command = (
  state,
  dispatch
) => {
  const { selection } = state;
  if (!(selection instanceof NodeSelection)) return false;

  let figurePos = -1;
  let figureSize = 0;

  if (selection.node.type.name === 'figure') {
    figurePos = selection.from;
    figureSize = selection.node.nodeSize;
  } else {
    const { $from } = selection;
    for (let depth = $from.depth; depth >= 0; depth--) {
      const node = $from.node(depth);
      if (node.type.name === 'figure') {
        figurePos = $from.before(depth);
        figureSize = node.nodeSize;
        break;
      }
    }
  }

  if (figurePos < 0) return false;

  if (dispatch) {
    const afterFigure = figurePos + figureSize;
    const next = state.doc.resolve(afterFigure).nodeAfter;
    let tr = state.tr;
    if (!next || next.type.name !== 'paragraph') {
      tr = tr.insert(afterFigure, state.schema.nodes.paragraph.create());
    }
    tr.setSelection(TextSelection.create(tr.doc, afterFigure + 1));
    dispatch(tr.scrollIntoView());
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

// Async asset picker the host wires in via the plugin factory. Returns
// `null` when the user cancels.
export type FigureAssetPicker = () => Promise<{
  src: string;
  alt?: string | null;
  title?: string | null;
} | null>;

type FigureInsertPluginState = { pickAsset: FigureAssetPicker };

const figureInsertPluginKey = new PluginKey<FigureInsertPluginState>(
  'figure-insert'
);

// Holds the picker callback in plugin state so the trigger function below
// can reach it from any `EditorView` without a closure. Lets the editor
// component stay presentational — it forwards `pickAsset` once, the
// toolbar handler is just `triggerFigureInsert(view)`.
export const figureInsertPlugin = ({
  pickAsset,
}: {
  pickAsset: FigureAssetPicker;
}): Plugin<FigureInsertPluginState> =>
  new Plugin<FigureInsertPluginState>({
    key: figureInsertPluginKey,
    state: {
      init: () => ({ pickAsset }),
      apply: (_tr, value) => value,
    },
  });

// Runs the picker (async) then dispatches `insertFigure` against the live
// view. Lives outside `Command` because PM commands are sync — this is the
// orchestrator on top.
export const triggerFigureInsert = async (
  view: EditorView
): Promise<boolean> => {
  const pluginState = figureInsertPluginKey.getState(view.state);
  if (!pluginState) return false;
  // Snapshot `canInsertFigure` before awaiting — if the selection moves
  // during the picker, we still won't insert into an invalid position
  // because `insertFigure` re-checks at dispatch time.
  if (!canInsertFigure(view.state)) return false;

  const picked = await pluginState.pickAsset();
  if (!picked) return false;

  return insertFigure({
    src: picked.src,
    alt: picked.alt ?? null,
    title: picked.title ?? null,
  })(view.state, view.dispatch);
};
