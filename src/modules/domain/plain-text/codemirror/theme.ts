import { catppuccinLatte } from '@catppuccin/codemirror';
import { type Extension, Prec } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { vscodeDarkInit } from '@uiw/codemirror-theme-vscode';

const fontFamily = "'FiraCode-Regular', 'SFMono-Regular', monospace";

// Fits the editor into the page: the page's background and the app's
// monospace font, the search panel's fields and buttons in the app's style,
// changes in the colors of the app's diffs, and merge conflicts with each
// side in its own color and actions above them. The colors are the app's,
// for the light or dark mode in use. It takes precedence over the color
// theme it is used with.
const appOverrides: Extension = Prec.high(
  EditorView.theme({
    '&': {
      backgroundColor: 'transparent',
      fontSize: '0.875rem',
      // TODO: Remove once the app's root element stops centring text.
      textAlign: 'left',
    },
    '&.cm-focused': { outline: 'none' },
    '&.cm-editor .cm-scroller': { fontFamily, lineHeight: '1.5' },
    '.cm-content': { padding: '0.5rem 0 50vh' },
    '.cm-gutters': { backgroundColor: 'transparent', border: 'none' },
    '.cm-panels.cm-panels-top': {
      borderBottom: '1px solid var(--plain-text-editor-border)',
    },
    '.cm-panels.cm-panels-bottom': {
      borderTop: '1px solid var(--plain-text-editor-border)',
    },
    '.cm-panel.cm-search': {
      padding: '0.5rem 2rem 0.5rem 0.75rem',
      fontFamily: 'var(--font-ui), sans-serif',
    },
    '.cm-panel.cm-search label': { fontSize: '0.8125rem' },
    '.cm-panel.cm-search [name=close]': {
      top: '0.5rem',
      right: '0.75rem',
      fontSize: '1rem',
      cursor: 'pointer',
    },
    '.cm-textfield, .cm-button': {
      backgroundImage: 'none',
      backgroundColor: 'var(--plain-text-editor-control-background)',
      color: 'inherit',
      border: '1px solid var(--plain-text-editor-border)',
      borderRadius: '0.375rem',
      padding: '0.125rem 0.5rem',
      fontSize: '0.8125rem',
    },
    '.cm-textfield:focus': {
      outline: '2px solid var(--plain-text-editor-focus)',
      outlineOffset: '-1px',
    },
    '.cm-button': { cursor: 'pointer' },
    '.cm-button:active': { backgroundImage: 'none' },
    '.cm-diagnostic': { fontFamily: 'var(--font-ui), sans-serif' },
    // Overriding the diff styles.
    '&.cm-merge-b .cm-changedText': {
      background: 'var(--diff-insert-background)',
      color: 'var(--diff-text, inherit)',
    },
    '&.cm-merge-b .cm-deletedChunk .cm-deletedText': {
      background: 'var(--diff-delete-background)',
      color: 'var(--diff-text, inherit)',
    },
    '&.cm-merge-b .cm-changedText *, &.cm-merge-b .cm-deletedText *': {
      color: 'var(--diff-text, inherit)',
    },
    '.cm-mergeConflictMarker': {
      backgroundColor: 'var(--merge-conflict-marker-background)',
    },
    '.cm-mergeConflictTarget': {
      backgroundColor: 'var(--merge-conflict-target-background)',
    },
    '.cm-mergeConflictBase': {
      backgroundColor: 'var(--merge-conflict-base-background)',
    },
    '.cm-mergeConflictSource': {
      backgroundColor: 'var(--merge-conflict-source-background)',
    },
    '.cm-mergeConflictActions': {
      display: 'flex',
      gap: '0.5rem',
      padding: '0.5rem 6px 0.25rem',
      fontFamily: 'var(--font-ui), sans-serif',
    },
    '.cm-mergeConflictAction': {
      backgroundColor: 'transparent',
      color: 'var(--plain-text-editor-action)',
      border: '1px solid var(--plain-text-editor-action)',
      padding: '0.125rem 0.625rem',
      fontSize: '0.8125rem',
      fontWeight: '500',
      cursor: 'pointer',
    },
    '.cm-mergeConflictAction:hover': {
      backgroundColor: 'var(--plain-text-editor-action-hover-background)',
    },
  })
);

const catppuccinLatteOverrides: Extension = Prec.high(
  EditorView.theme({
    '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: '#4c4f6912' },
    '.cm-panels': {
      backgroundColor: 'var(--plain-text-editor-panel-background)',
    },
  })
);

const vscodeDarkOverrides = { foreground: '#d4d4d4' };

export const lightTheme: Extension = [
  catppuccinLatte,
  catppuccinLatteOverrides,
  appOverrides,
];

export const darkTheme: Extension = [
  vscodeDarkInit({ settings: vscodeDarkOverrides }),
  appOverrides,
];
