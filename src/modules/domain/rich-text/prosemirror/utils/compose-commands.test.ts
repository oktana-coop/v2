import { type Command } from 'prosemirror-state';

import { editorState, para, runCommand } from '../test-utils';
import { composeCommands, composeModes } from './compose-commands';

// A command that always declines (never dispatches).
const fail: Command = () => false;

const insertText =
  (text: string, pos: number): Command =>
  (state, dispatch) => {
    dispatch?.(state.tr.insertText(text, pos));
    return true;
  };

describe('composeCommands', () => {
  it('returns true for an empty command list and dispatches nothing', () => {
    const state = editorState([para('hi')]);
    const { handled, next } = runCommand({
      state,
      command: composeCommands([]),
    });
    expect(handled).toBe(true);
    // runCommand returns the original state untouched when nothing dispatches.
    expect(next).toBe(state);
  });

  it('does not dispatch when every command declines', () => {
    const state = editorState([para('hi')]);
    const { handled, next } = runCommand({
      state,
      command: composeCommands([fail, fail]),
    });
    // Default mode is ANY_SUCCESS: no command succeeded, so the result is false.
    expect(handled).toBe(false);
    expect(next).toBe(state);
  });

  it('dispatches the merged transaction when a command produces steps', () => {
    const { handled, next } = runCommand({
      state: editorState([para('hello')]),
      command: composeCommands([fail, insertText('x', 1)]),
    });
    expect(handled).toBe(true);
    expect(next.doc.textContent).toBe('xhello');
  });

  it('feeds each command the cumulative state from previous commands', () => {
    let seenBySecond: string | undefined;
    const recordThenInsert: Command = (state, dispatch) => {
      seenBySecond = state.doc.textContent;
      dispatch?.(state.tr.insertText('B', 1));
      return true;
    };

    const { next } = runCommand({
      state: editorState([para('x')]),
      command: composeCommands([insertText('A', 1), recordThenInsert]),
    });

    // The second command sees the first command's insertion already applied.
    expect(seenBySecond).toBe('Ax');
    // Both steps merge into one transaction, applied in order.
    expect(next.doc.textContent).toBe('BAx');
  });

  describe('result modes', () => {
    it('ANY_SUCCESS returns true when at least one command succeeds', () => {
      const { handled } = runCommand({
        state: editorState([para('hello')]),
        command: composeCommands([fail, insertText('x', 1)], {
          mode: composeModes.ANY_SUCCESS,
        }),
      });
      expect(handled).toBe(true);
    });

    it('ALL_SUCCESS returns false if any command fails, but still dispatches the steps that succeeded', () => {
      const { handled, next } = runCommand({
        state: editorState([para('hello')]),
        command: composeCommands([insertText('x', 1), fail], {
          mode: composeModes.ALL_SUCCESS,
        }),
      });
      expect(handled).toBe(false);
      // The successful command's steps are still applied.
      expect(next.doc.textContent).toBe('xhello');
    });

    it('LAST_RESULT returns the result of the final command', () => {
      const lastFails = runCommand({
        state: editorState([para('hello')]),
        command: composeCommands([insertText('x', 1), fail], {
          mode: composeModes.LAST_RESULT,
        }),
      });
      expect(lastFails.handled).toBe(false);

      const lastSucceeds = runCommand({
        state: editorState([para('hello')]),
        command: composeCommands([fail, insertText('x', 1)], {
          mode: composeModes.LAST_RESULT,
        }),
      });
      expect(lastSucceeds.handled).toBe(true);
    });
  });
});
