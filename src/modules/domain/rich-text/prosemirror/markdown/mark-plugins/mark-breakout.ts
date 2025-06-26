import { Mark, MarkType, Node } from 'prosemirror-model';
import { EditorState, Selection, Transaction } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';

const findMarkEnd = ($from: Selection['$from'], markType: MarkType): number => {
  let markEnd = $from.pos;

  $from.parent.forEach((child: Node, offset: number) => {
    if (
      child.isText &&
      child.text &&
      child.marks.some((m: Mark) => m.type === markType)
    ) {
      const start = $from.start() + offset;
      const end = start + child.text.length;
      if ($from.pos >= start && $from.pos <= end) {
        markEnd = end;
      }
    }
  });

  return markEnd;
};

const isMarkActive = (
  $from: Selection['$from'],
  storedMarks: readonly Mark[] | null,
  markType: MarkType
): boolean => {
  const activeMarks = $from.marks();
  return (
    storedMarks?.some((mark: Mark) => mark.type === markType) ||
    activeMarks.some((mark: Mark) => mark.type === markType)
  );
};

const createMarkBreakoutTransaction = (
  state: EditorState,
  $from: Selection['$from'],
  markType: MarkType
): Transaction => {
  const isAtBlockEnd = $from.parentOffset === $from.parent.content.size;

  if (isAtBlockEnd) {
    // In this case we are at the end of a block. We need to make sure that:
    // 1. The user can continue typing in this block (break out of the marked span)
    // 2. Right arrow doesn't get "stuck" in the end of the marked section
    // (e.g. does something on first press and then continues as usual)
    // TODO: Figure out why don't see an actual space typed in the editor.
    let tr = state.tr
      .removeStoredMark(markType)
      .insertText(' ', $from.pos)
      .removeMark($from.pos, $from.pos + 1, markType);

    tr = tr.setSelection(Selection.near(tr.doc.resolve($from.pos + 1), 1));

    return tr;
  }

  // Not at end of block: move selection out of mark and remove the stored mark
  return state.tr
    .setSelection(Selection.near(state.doc.resolve($from.pos + 1), 1))
    .removeStoredMark(markType);
};

export const interceptIfAtTheEndOfMark = (
  view: EditorView,
  markType: MarkType
): boolean => {
  const { state, dispatch } = view;
  const {
    storedMarks,
    selection: { $from },
  } = state;

  if (!isMarkActive($from, storedMarks, markType)) return false;

  const markEnd = findMarkEnd($from, markType);
  if ($from.pos !== markEnd) return false;

  const tr = createMarkBreakoutTransaction(state, $from, markType);
  dispatch(tr);
  return true;
};
