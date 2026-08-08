import { getMatchHighlights, getSearchState } from 'prosemirror-search';
import { type EditorState } from 'prosemirror-state';

export type SearchMatch = { from: number; to: number };

export const getSearchQueryText = (state: EditorState): string =>
  getSearchState(state)?.query.search ?? '';

// All matches of the active search query, in document order, read from the
// match-highlight decorations the search plugin has already computed.
export const getSearchMatches = (state: EditorState): SearchMatch[] =>
  getMatchHighlights(state)
    .find()
    .map((decoration) => ({ from: decoration.from, to: decoration.to }));

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

// Initial search query for the current selection: the selected text of the
// first non-empty textblock, up to its first newline (code blocks can contain
// literal newlines). Matches can't span block boundaries and the find input
// is single-line, so a longer seed could never be found or displayed.
export const getSearchSeedFromSelection = (
  state: EditorState
): string | null => {
  const { selection } = state;
  if (selection.empty) {
    return null;
  }

  let seed: string | null = null;
  state.doc.nodesBetween(selection.from, selection.to, (node, pos) => {
    if (seed !== null) {
      return false;
    }
    if (!node.isTextblock) {
      return true;
    }

    const text = state.doc.textBetween(
      Math.max(selection.from, pos + 1),
      Math.min(selection.to, pos + 1 + node.content.size)
    );
    const firstLine = text.split('\n').find((line) => line.trim() !== '');
    if (firstLine) {
      seed = firstLine;
    }
    return false;
  });

  return seed;
};
