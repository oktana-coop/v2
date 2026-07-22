import { search } from 'prosemirror-search';

// Stores the active search query and highlights its matches with the
// `ProseMirror-search-match` / `ProseMirror-active-search-match` classes
// (styled in App.css).
export const searchPlugin = search;
