import {
  findNext,
  findPrev,
  SearchQuery,
  setSearchState,
} from 'prosemirror-search';
import { type Command, TextSelection } from 'prosemirror-state';

import { getSearchMatches, type SearchMatch } from './state';

// Move the selection to the next/previous match, wrapping around the
// document edges. The selected match gets the active-match highlight.
export const findNextSearchMatch: Command = findNext;
export const findPreviousSearchMatch: Command = findPrev;

export type SearchQueryConfig = {
  search: string;
  caseSensitive?: boolean;
};

const selectMatch =
  (match: SearchMatch): Command =>
  (state, dispatch) => {
    dispatch?.(
      state.tr
        .setSelection(TextSelection.create(state.doc, match.from, match.to))
        .scrollIntoView()
    );
    return true;
  };

export const setSearchQuery =
  (config: SearchQueryConfig): Command =>
  (state, dispatch) => {
    dispatch?.(setSearchState(state.tr, new SearchQuery(config)));
    return true;
  };

// Select the first match at or after the selection start, wrapping to the
// beginning of the document. Unlike `findNextSearchMatch` (which searches
// after the selection end), this keeps the selection on the current match
// while the user extends the query.
export const selectNearestSearchMatch: Command = (state, dispatch) => {
  const matches = getSearchMatches(state);
  const { from } = state.selection;
  const nearest = matches.find((match) => match.from >= from) ?? matches[0];

  if (!nearest) {
    return false;
  }

  return selectMatch(nearest)(state, dispatch);
};

export const clearSearchQuery: Command = (state, dispatch) => {
  dispatch?.(setSearchState(state.tr, new SearchQuery({ search: '' })));
  return true;
};
