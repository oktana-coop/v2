import { Command, EditorState, Transaction } from 'prosemirror-state';

type ComposeMode = 'lastResult' | 'anySuccess' | 'allSuccess';

type ComposeOptions = {
  readonly mode: ComposeMode;
};

/**
 * Executes a command and captures its transaction
 */
const executeCommand = (
  command: Command,
  state: EditorState
): { success: boolean; transaction?: Transaction } => {
  let capturedTransaction: Transaction | undefined = undefined;

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
  let result = baseTr;

  // Copy all transformation steps
  commandTr.steps.forEach((step) => {
    result = result.step(step);
  });

  // Update selection if it changed
  if (!commandTr.selection.eq(baseTr.selection)) {
    result = result.setSelection(commandTr.selection);
  }

  return result;
};

/**
 * Reduces commands into a single transaction, tracking results for different success modes
 */
const reduceCommands = (
  commands: readonly Command[],
  initialState: EditorState,
  baseTr: Transaction
): { transaction: Transaction; results: readonly boolean[] } => {
  const results: boolean[] = [];

  const executeStep = (
    acc: { state: EditorState; transaction: Transaction },
    command: Command
  ): { state: EditorState; transaction: Transaction } => {
    const result = executeCommand(command, acc.state);
    results.push(result.success);

    if (result.success) {
      const mergedTr = applyCommandSteps(acc.transaction, result.transaction!);
      const newState = acc.state.apply(result.transaction!);

      return {
        state: newState,
        transaction: mergedTr,
      };
    }

    // Command failed, continue with unchanged accumulator
    return acc;
  };

  const finalResult = commands.reduce(executeStep, {
    state: initialState,
    transaction: baseTr,
  });

  return {
    transaction: finalResult.transaction,
    results,
  };
};

/**
 * Determines the boolean result based on the compose mode and command results
 */
const getComposeResult = (
  results: readonly boolean[],
  mode: ComposeMode
): boolean => {
  switch (mode) {
    case 'lastResult':
      return results.length > 0 ? results[results.length - 1] : true;
    case 'anySuccess':
      return results.some((result) => result);
    case 'allSuccess':
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
    commands: readonly Command[],
    options: ComposeOptions = { mode: 'anySuccess' }
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
    const result = getComposeResult(results, options.mode);

    return result;
  };
