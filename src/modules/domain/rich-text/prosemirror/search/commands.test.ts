import { para, runCommand, withCursorAt } from '../test-utils';
import {
  clearSearchQuery,
  selectFirstMatchAtOrAfterSelection,
} from './commands';
import { getSearchMatches } from './state';
import { stateWithQuery } from './test-utils';

describe('clearSearchQuery', () => {
  it('removes the matches of the cleared query', () => {
    const state = stateWithQuery([para('hello')], 'hello');
    const { next } = runCommand({ state, command: clearSearchQuery });
    expect(getSearchMatches(next)).toEqual([]);
  });
});

describe('selectFirstMatchAtOrAfterSelection', () => {
  it('selects the first match at or after the cursor', () => {
    const state = stateWithQuery([para('hello world hello')], 'hello');
    const withCursor = withCursorAt({ state, pos: 8 });
    const { handled, next } = runCommand({
      state: withCursor,
      command: selectFirstMatchAtOrAfterSelection,
    });
    expect(handled).toBe(true);
    expect({ from: next.selection.from, to: next.selection.to }).toEqual({
      from: 13,
      to: 18,
    });
  });

  it('stays on the match the cursor starts on', () => {
    const state = stateWithQuery([para('hello world hello')], 'hello');
    const withCursor = withCursorAt({ state, pos: 13 });
    const { next } = runCommand({
      state: withCursor,
      command: selectFirstMatchAtOrAfterSelection,
    });
    expect({ from: next.selection.from, to: next.selection.to }).toEqual({
      from: 13,
      to: 18,
    });
  });

  it('wraps to the first match when none follow the cursor', () => {
    const state = stateWithQuery([para('hello world hello')], 'hello');
    const withCursor = withCursorAt({ state, pos: 18 });
    const { next } = runCommand({
      state: withCursor,
      command: selectFirstMatchAtOrAfterSelection,
    });
    expect({ from: next.selection.from, to: next.selection.to }).toEqual({
      from: 1,
      to: 6,
    });
  });

  it('is not handled when there are no matches', () => {
    const state = stateWithQuery([para('hello')], 'xyz');
    const { handled } = runCommand({
      state,
      command: selectFirstMatchAtOrAfterSelection,
    });
    expect(handled).toBe(false);
  });
});
