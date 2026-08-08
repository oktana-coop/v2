import {
  findNext,
  findPrev,
  SearchQuery,
  setSearchState,
} from 'prosemirror-search';
import { type Command, TextSelection } from 'prosemirror-state';

import { getSearchMatches } from './state';

export const findNextSearchMatch: Command = findNext;
export const findPreviousSearchMatch: Command = findPrev;

export const setSearchQuery =
  (search: string): Command =>
  (state, dispatch) => {
    if (dispatch) {
      dispatch(setSearchState(state.tr, new SearchQuery({ search })));
    }
    return true;
  };

export const clearSearchQuery: Command = setSearchQuery('');

// Re-anchors the active match after the query changes, wrapping around the
// document. Unlike `findNextSearchMatch` — an advance gesture, which must move
// past the current match — this stays on a match under the selection, so the
// active match holds still while the user extends the query.
export const selectFirstMatchAtOrAfterSelection: Command = (
  state,
  dispatch
) => {
  const matches = getSearchMatches(state);
  const { from } = state.selection;
  const anchor = matches.find((match) => match.from >= from) ?? matches[0];

  if (!anchor) {
    return false;
  }

  if (dispatch) {
    dispatch(
      state.tr
        .setSelection(TextSelection.create(state.doc, anchor.from, anchor.to))
        .scrollIntoView()
    );
  }
  return true;
};
