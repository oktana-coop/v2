import { toggleMark } from 'prosemirror-commands';
import { Attrs, MarkType, Schema } from 'prosemirror-model';
import {
  Command,
  EditorState,
  type TextSelection,
  Transaction,
} from 'prosemirror-state';
import { AddMarkStep, RemoveMarkStep } from 'prosemirror-transform';

import { LinkAttrs } from '../models/link';
import { isMarkActive } from './selection';

export const toggleStrong = (schema: Schema) =>
  toggleMarkCommand(schema.marks.strong);

export const toggleEm = (schema: Schema) => toggleMarkCommand(schema.marks.em);

export const toggleCode = (schema: Schema) =>
  toggleMarkCommand(schema.marks.code);

export const addLink =
  (schema: Schema) =>
  (attrs: LinkAttrs): Command => {
    return (
      state: EditorState,
      dispatch: ((tr: Transaction) => void) | undefined
    ) => {
      // if the selection is empty, insert text and mark at the cursor position
      if (state.selection.empty && attrs.title.length > 0) {
        const { tr } = state;

        tr.insertText(attrs.title, state.selection.from).addMark(
          state.selection.from,
          state.selection.from + attrs.title.length,
          schema.marks.link.create(attrs)
        );

        if (dispatch) {
          dispatch(tr.scrollIntoView());
        }

        return true;
      }

      // if the selection is not empty, apply the link mark on it if it's not already active
      if (!isMarkActive(schema.marks.link)(state)) {
        return toggleMark(schema.marks.link, attrs)(state, dispatch);
      }

      return false;
    };
  };

export const removeLink = (schema: Schema): Command => {
  return (
    state: EditorState,
    dispatch: ((tr: Transaction) => void) | undefined
  ) => {
    if (isMarkActive(schema.marks.link)(state)) {
      return toggleMark(schema.marks.link)(state, dispatch);
    }

    return false;
  };
};

export const updateLink =
  (schema: Schema) =>
  (attrs: LinkAttrs): Command => {
    return (
      state: EditorState,
      dispatch: ((tr: Transaction) => void) | undefined
    ) => {
      if (isMarkActive(schema.marks.link)(state)) {
        const { tr } = state;
        const { from, to } = state.selection as TextSelection;
        tr.removeMark(from, to, schema.marks.link).addMark(
          from,
          to,
          schema.marks.link.create(attrs)
        );
        if (dispatch) {
          dispatch(tr.scrollIntoView());
        }
        return true;
      }

      return false;
    };
  };

const toggleMarkCommand = (mark: MarkType, attrs?: Attrs): Command => {
  return (
    state: EditorState,
    dispatch: ((tr: Transaction) => void) | undefined
  ) => {
    return toggleMark(mark, attrs)(state, dispatch);
  };
};

export const transactionUpdatesMarks = (transaction: Transaction): boolean => {
  return transaction.steps.some(
    (step) => step instanceof AddMarkStep || step instanceof RemoveMarkStep
  );
};
