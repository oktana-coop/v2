import { Command } from 'prosemirror-state';

export const deleteCharBeforeCursor: Command = (state, dispatch) => {
  const { selection } = state;

  if (!selection.empty) return false;

  const { $from } = selection;
  const pos = $from.pos;

  if (pos === 0) return false; // Nothing to delete

  const tr = state.tr.delete(pos - 1, pos);
  if (dispatch) dispatch(tr);
  return true;
};

export const deleteCharAfterCursor: Command = (state, dispatch) => {
  const { selection } = state;

  if (!selection.empty) return false;

  const { $from } = selection;
  const pos = $from.pos;

  if (pos >= state.doc.content.size) return false; // Nothing to delete

  const tr = state.tr.delete(pos, pos + 1);
  if (dispatch) dispatch(tr);
  return true;
};
