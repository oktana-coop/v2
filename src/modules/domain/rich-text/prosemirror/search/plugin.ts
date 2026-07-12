import { search } from 'prosemirror-search';

// Stores the active search query and highlights its matches with the
// `ProseMirror-search-match` / `ProseMirror-active-search-match` classes
// (styled in App.css).
// Note that prosemirror-search scans each textblock separately, so matches
// can't span block boundaries — same behavior as browser find-in-page.
export const searchPlugin = search;
