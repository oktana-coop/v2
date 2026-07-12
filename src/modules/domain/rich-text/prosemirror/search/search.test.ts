import { type Node } from 'prosemirror-model';
import { EditorState, TextSelection } from 'prosemirror-state';

import {
  editorState,
  heading,
  para,
  runCommand,
  withCursorAt,
} from '../test-utils';
import {
  clearSearchQuery,
  type SearchQueryConfig,
  selectNearestSearchMatch,
  setSearchQuery,
} from './commands';
import { searchPlugin } from './plugin';
import { getActiveSearchMatchIndex, getSearchMatches } from './state';

const stateWithQuery = (
  children: Node[],
  config: SearchQueryConfig
): EditorState => {
  const state = editorState(children, [searchPlugin()]);
  return runCommand({ state, command: setSearchQuery(config) }).next;
};

const withSelectionAt = ({
  state,
  from,
  to,
}: {
  state: EditorState;
  from: number;
  to: number;
}): EditorState =>
  state.apply(state.tr.setSelection(TextSelection.create(state.doc, from, to)));

describe('getSearchMatches', () => {
  it('returns all matches in document order', () => {
    const state = stateWithQuery([para('hello world hello')], {
      search: 'hello',
    });
    expect(getSearchMatches(state)).toEqual([
      { from: 1, to: 6 },
      { from: 13, to: 18 },
    ]);
  });

  it('finds matches across blocks', () => {
    const state = stateWithQuery([heading({ text: 'hello' }), para('hello')], {
      search: 'hello',
    });
    expect(getSearchMatches(state)).toHaveLength(2);
  });

  it('is case-insensitive by default', () => {
    const state = stateWithQuery([para('hello Hello')], { search: 'Hello' });
    expect(getSearchMatches(state)).toHaveLength(2);
  });

  it('respects case-sensitive queries', () => {
    const state = stateWithQuery([para('hello Hello')], {
      search: 'Hello',
      caseSensitive: true,
    });
    expect(getSearchMatches(state)).toEqual([{ from: 7, to: 12 }]);
  });

  it('returns no matches when no query has been set', () => {
    const state = editorState([para('hello')], [searchPlugin()]);
    expect(getSearchMatches(state)).toEqual([]);
  });

  it('returns no matches after the query is cleared', () => {
    const state = stateWithQuery([para('hello')], { search: 'hello' });
    const { next } = runCommand({ state, command: clearSearchQuery });
    expect(getSearchMatches(next)).toEqual([]);
  });
});

describe('getActiveSearchMatchIndex', () => {
  it('returns the index of the match the selection sits on', () => {
    const state = stateWithQuery([para('hello world hello')], {
      search: 'hello',
    });
    const selected = withSelectionAt({ state, from: 13, to: 18 });
    const matches = getSearchMatches(selected);
    expect(getActiveSearchMatchIndex(selected, matches)).toBe(1);
  });

  it('returns null when the selection is not on a match', () => {
    const state = stateWithQuery([para('hello world hello')], {
      search: 'hello',
    });
    const withCursor = withCursorAt({ state, pos: 8 });
    const matches = getSearchMatches(withCursor);
    expect(getActiveSearchMatchIndex(withCursor, matches)).toBeNull();
  });
});

describe('selectNearestSearchMatch', () => {
  it('selects the first match at or after the cursor', () => {
    const state = stateWithQuery([para('hello world hello')], {
      search: 'hello',
    });
    const withCursor = withCursorAt({ state, pos: 8 });
    const { handled, next } = runCommand({
      state: withCursor,
      command: selectNearestSearchMatch,
    });
    expect(handled).toBe(true);
    expect({ from: next.selection.from, to: next.selection.to }).toEqual({
      from: 13,
      to: 18,
    });
  });

  it('stays on the match the cursor starts on', () => {
    const state = stateWithQuery([para('hello world hello')], {
      search: 'hello',
    });
    const withCursor = withCursorAt({ state, pos: 13 });
    const { next } = runCommand({
      state: withCursor,
      command: selectNearestSearchMatch,
    });
    expect({ from: next.selection.from, to: next.selection.to }).toEqual({
      from: 13,
      to: 18,
    });
  });

  it('wraps to the first match when none follow the cursor', () => {
    const state = stateWithQuery([para('hello world hello')], {
      search: 'hello',
    });
    const withCursor = withCursorAt({ state, pos: 18 });
    const { next } = runCommand({
      state: withCursor,
      command: selectNearestSearchMatch,
    });
    expect({ from: next.selection.from, to: next.selection.to }).toEqual({
      from: 1,
      to: 6,
    });
  });

  it('is not handled when there are no matches', () => {
    const state = stateWithQuery([para('hello')], { search: 'xyz' });
    const { handled } = runCommand({
      state,
      command: selectNearestSearchMatch,
    });
    expect(handled).toBe(false);
  });
});
