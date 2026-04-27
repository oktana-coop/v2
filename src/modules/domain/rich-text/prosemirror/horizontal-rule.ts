import type { Command, EditorState } from 'prosemirror-state';

export const canInsertHorizontalRule = (state: EditorState): boolean => {
  const { $from, empty } = state.selection;
  return (
    empty &&
    $from.parent.type.name === 'paragraph' &&
    $from.parent.content.size === 0
  );
};

export const insertHorizontalRule: Command = (state, dispatch) => {
  if (!canInsertHorizontalRule(state)) {
    return false;
  }

  const hr = state.schema.nodes.horizontal_rule;
  if (!hr) {
    return false;
  }

  if (dispatch) {
    const { $from } = state.selection;

    dispatch(
      state.tr
        .replaceRangeWith($from.before(), $from.after(), hr.create())
        .scrollIntoView()
    );
  }

  return true;
};
