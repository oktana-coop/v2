import { getSearchState } from 'prosemirror-search';
import { type EditorState } from 'prosemirror-state';

export type SearchMatch = { from: number; to: number };

// All matches of the active search query, in document order.
export const getSearchMatches = (state: EditorState): SearchMatch[] => {
  const search = getSearchState(state);
  if (!search?.query.valid) {
    return [];
  }

  const matches: SearchMatch[] = [];
  let from = 0;
  for (;;) {
    const result = search.query.findNext(state, from);
    if (!result) {
      break;
    }
    matches.push({ from: result.from, to: result.to });
    from = Math.max(result.to, result.from + 1);
  }

  return matches;
};

// Index (in document order) of the match the selection currently sits on,
// or null when the selection isn't on a match.
export const getActiveSearchMatchIndex = (
  state: EditorState,
  matches: SearchMatch[]
): number | null => {
  const { from, to } = state.selection;
  const index = matches.findIndex(
    (match) => match.from === from && match.to === to
  );
  return index === -1 ? null : index;
};
