import { type Node } from 'prosemirror-model';
import { EditorState } from 'prosemirror-state';

import {
  editorState,
  heading,
  para,
  runCommand,
  withCursorAt,
  withSelectionAt,
} from '../test-utils';
import {
  clearSearchQuery,
  selectFirstMatchAtOrAfterSelection,
  setSearchQuery,
} from './commands';
import { searchPlugin } from './plugin';
import {
  getActiveSearchMatchIndex,
  getSearchMatches,
  getSearchQueryText,
  getSearchSeedFromSelection,
} from './state';

const stateWithQuery = (children: Node[], search: string): EditorState => {
  const state = editorState(children, [searchPlugin()]);
  return runCommand({ state, command: setSearchQuery(search) }).next;
};

describe('getSearchMatches', () => {
  it('returns all matches in document order', () => {
    const state = stateWithQuery([para('hello world hello')], 'hello');
    expect(getSearchMatches(state)).toEqual([
      { from: 1, to: 6 },
      { from: 13, to: 18 },
    ]);
  });

  it('finds matches across blocks', () => {
    const state = stateWithQuery(
      [heading({ text: 'hello' }), para('hello')],
      'hello'
    );
    expect(getSearchMatches(state)).toHaveLength(2);
  });

  it('is case-insensitive', () => {
    const state = stateWithQuery([para('hello Hello')], 'Hello');
    expect(getSearchMatches(state)).toHaveLength(2);
  });

  it('returns no matches when no query has been set', () => {
    const state = editorState([para('hello')], [searchPlugin()]);
    expect(getSearchMatches(state)).toEqual([]);
  });

  it('returns no matches after the query is cleared', () => {
    const state = stateWithQuery([para('hello')], 'hello');
    const { next } = runCommand({ state, command: clearSearchQuery });
    expect(getSearchMatches(next)).toEqual([]);
  });
});

describe('searchPlugin', () => {
  it('keeps the query when the state is reconfigured with a fresh plugin', () => {
    const state = stateWithQuery([para('hello')], 'hello');
    const reconfigured = state.reconfigure({ plugins: [searchPlugin()] });
    expect(getSearchQueryText(reconfigured)).toBe('hello');
    expect(getSearchMatches(reconfigured)).toHaveLength(1);
  });
});

describe('getSearchQueryText', () => {
  it('returns the active query', () => {
    const state = stateWithQuery([para('hello')], 'hello');
    expect(getSearchQueryText(state)).toBe('hello');
  });

  it('returns the empty string when no query has been set', () => {
    const state = editorState([para('hello')], [searchPlugin()]);
    expect(getSearchQueryText(state)).toBe('');
  });

  it('returns the empty string without the search plugin', () => {
    const state = editorState([para('hello')]);
    expect(getSearchQueryText(state)).toBe('');
  });
});

describe('getActiveSearchMatchIndex', () => {
  it('returns the index of the match the selection sits on', () => {
    const state = stateWithQuery([para('hello world hello')], 'hello');
    const selected = withSelectionAt({ state, from: 13, to: 18 });
    const matches = getSearchMatches(selected);
    expect(getActiveSearchMatchIndex(selected, matches)).toBe(1);
  });

  it('returns null when the selection is not on a match', () => {
    const state = stateWithQuery([para('hello world hello')], 'hello');
    const withCursor = withCursorAt({ state, pos: 8 });
    const matches = getSearchMatches(withCursor);
    expect(getActiveSearchMatchIndex(withCursor, matches)).toBeNull();
  });
});

describe('getSearchSeedFromSelection', () => {
  it('returns the selected text within a single block', () => {
    const state = withSelectionAt({
      state: editorState([para('hello world')]),
      from: 1,
      to: 6,
    });
    expect(getSearchSeedFromSelection(state)).toBe('hello');
  });

  it('returns the first block of a multi-block selection', () => {
    const state = withSelectionAt({
      state: editorState([para('hello'), para('world')]),
      from: 3,
      to: 13,
    });
    expect(getSearchSeedFromSelection(state)).toBe('llo');
  });

  it('skips leading blocks without selected text', () => {
    const state = withSelectionAt({
      state: editorState([para('hello'), para('world')]),
      from: 6,
      to: 13,
    });
    expect(getSearchSeedFromSelection(state)).toBe('world');
  });

  it('returns null for a cursor without a range', () => {
    const state = withCursorAt({
      state: editorState([para('hello')]),
      pos: 2,
    });
    expect(getSearchSeedFromSelection(state)).toBeNull();
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
