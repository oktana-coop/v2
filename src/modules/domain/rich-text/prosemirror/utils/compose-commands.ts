import { Command, EditorState, Transaction } from 'prosemirror-state';
import type { ValueOf } from 'type-fest';

export const LAST_RESULT = 'LAST_RESULT';
export const ANY_SUCCESS = 'ANY_SUCCESS';
export const ALL_SUCCESS = 'ALL_SUCCESS';

export const composeModes = {
  LAST_RESULT,
  ANY_SUCCESS,
  ALL_SUCCESS,
} as const;

export type ComposeMode = ValueOf<typeof composeModes>;

type ComposeOptions = {
  mode: ComposeMode;
};

/**
 * Executes a command and captures its transaction
 */
const executeCommand = (
  command: Command,
  state: EditorState
): { success: boolean; transaction?: Transaction } => {
  let capturedTransaction: Transaction | undefined = undefined;

  // We just want the transaction steps, so we mock the dispatch function
  // to capture the transaction without actually applying it.
  const mockDispatch = (tr: Transaction): void => {
    capturedTransaction = tr;
  };

  const canExecute = command(state, mockDispatch);

  return canExecute && capturedTransaction
    ? { success: true, transaction: capturedTransaction }
    : { success: false };
};

/**
 * Applies a command's steps to the base transaction
 */
const applyCommandSteps = (
  baseTr: Transaction,
  commandTr: Transaction
): Transaction => {
  let tr = baseTr;

  // Copy all transformation steps
  commandTr.steps.forEach((step) => {
    tr = tr.step(step);
  });

  // Update selection if it changed
  if (!commandTr.selection.eq(baseTr.selection)) {
    tr = tr.setSelection(commandTr.selection);
  }

  return tr;
};

/**
 * Reduces commands into a single transaction, also collecting results
 * for each command execution.
 */
const reduceCommands = (
  commands: Command[],
  initialState: EditorState,
  baseTr: Transaction
): { transaction: Transaction; results: boolean[] } => {
  const compositeTrAndResult = commands.reduce<{
    state: EditorState;
    transaction: Transaction;
    results: boolean[];
  }>(
    (acc, command) => {
      const result = executeCommand(command, acc.state);

      if (result.success) {
        const mergedTr = applyCommandSteps(
          acc.transaction,
          result.transaction!
        );
        const newState = acc.state.apply(result.transaction!);

        return {
          state: newState,
          transaction: mergedTr,
          results: [...acc.results, true],
        };
      }

      return { ...acc, results: [...acc.results, false] };
    },
    {
      state: initialState,
      transaction: baseTr,
      results: [],
    }
  );

  return {
    transaction: compositeTrAndResult.transaction,
    results: compositeTrAndResult.results,
  };
};

/**
 * Determines the boolean result based on the compose mode and command results
 */
const getComposeResult = (results: boolean[], mode: ComposeMode): boolean => {
  switch (mode) {
    case LAST_RESULT:
      return results.length > 0 ? results[results.length - 1] : true;
    case ANY_SUCCESS:
      return results.some((result) => result);
    case ALL_SUCCESS:
      return results.every((result) => result);
  }
};

/**
 * Composes multiple ProseMirror commands into a single atomic transaction.
 *
 * Each command operates on the current state as modified by previous commands,
 * ensuring that all operations see the cumulative changes. The result is a
 * single command that can be undone atomically.
 *
 * @param commands - Array of commands to compose
 * @param options - Configuration for how to determine the boolean result
 * @returns A single command that executes all operations atomically
 */
export const composeCommands =
  (
    commands: Command[],
    options: ComposeOptions = { mode: ANY_SUCCESS }
  ): Command =>
  (state: EditorState, dispatch?: (tr: Transaction) => void): boolean => {
    if (commands.length === 0) {
      return true;
    }

    const { transaction, results } = reduceCommands(commands, state, state.tr);

    // Always dispatch if there are steps
    if (transaction.steps.length > 0) {
      dispatch?.(transaction);
    }

    // Return result based on the specified mode
    return getComposeResult(results, options.mode);
  };
