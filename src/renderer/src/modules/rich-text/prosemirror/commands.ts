import { toggleMark } from 'prosemirror-commands';
import { MarkType, Schema } from 'prosemirror-model';
import { Command, EditorState, Transaction } from 'prosemirror-state';
import { AddMarkStep, RemoveMarkStep } from 'prosemirror-transform';

export const toggleStrong = (schema: Schema) =>
  toggleMarkCommand(schema.marks.strong);

export const toggleEm = (schema: Schema) => toggleMarkCommand(schema.marks.em);

const toggleMarkCommand = (mark: MarkType): Command => {
  return (
    state: EditorState,
    dispatch: ((tr: Transaction) => void) | undefined
  ) => {
    return toggleMark(mark)(state, dispatch);
  };
};

export const transactionUpdatesMarks = (transaction: Transaction): boolean => {
  return transaction.steps.some(
    (step) => step instanceof AddMarkStep || step instanceof RemoveMarkStep
  );
};
