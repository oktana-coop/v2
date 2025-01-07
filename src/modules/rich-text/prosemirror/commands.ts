import { toggleMark } from 'prosemirror-commands';
import { Attrs, MarkType, Schema } from 'prosemirror-model';
import { Command, EditorState, Transaction } from 'prosemirror-state';
import { AddMarkStep, RemoveMarkStep } from 'prosemirror-transform';

import { LinkAttrs } from '../models/link';
import { isMarkActive } from './selection';

export const toggleStrong = (schema: Schema) =>
  toggleMarkCommand(schema.marks.strong);

export const toggleEm = (schema: Schema) => toggleMarkCommand(schema.marks.em);

export const addLink =
  (schema: Schema) =>
  (attrs: LinkAttrs): Command =>
    toggleMarkCommand(schema.marks.link, attrs);

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
