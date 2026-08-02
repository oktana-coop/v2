import { type EditorView } from 'prosemirror-view';

// Scroll the active search match into view by targeting its decoration DOM
// directly. The commands' transaction-level `scrollIntoView` is not enough:
// prosemirror-view ignores it while the DOM selection is outside the editor,
// which is exactly the find bar's situation (focus stays in its input).
// The class name is prosemirror-search's runtime decoration class, the same
// one the app styles in App.css.
export const scrollActiveSearchMatchIntoView = (view: EditorView): void => {
  const activeMatch = view.dom.querySelector(
    '.ProseMirror-active-search-match'
  );
  activeMatch?.scrollIntoView({ block: 'nearest' });
};
