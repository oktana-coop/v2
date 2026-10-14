import { catppuccinLatte } from '@catppuccin/codemirror';
import { type Extension, Prec } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { vscodeDarkInit } from '@uiw/codemirror-theme-vscode';

const fontFamily = "'FiraCode-Regular', 'SFMono-Regular', monospace";

// Fits the editor into the page: the page's background and the app's
// monospace font, and the search panel's fields and buttons in the app's
// style. It takes precedence over the colour theme it is used with.
const appOverrides = ({
  border,
  focus,
  controlBackground,
}: {
  border: string;
  focus: string;
  controlBackground: string;
}): Extension =>
  Prec.high(
    EditorView.theme({
      '&': {
        backgroundColor: 'transparent',
        fontSize: '0.875rem',
        // TODO: Remove once the app's root element stops centring text.
        textAlign: 'left',
      },
      '&.cm-focused': { outline: 'none' },
      '&.cm-editor .cm-scroller': { fontFamily, lineHeight: '1.5' },
      '.cm-content': { padding: '0.5rem 0' },
      '.cm-gutters': { backgroundColor: 'transparent', border: 'none' },
      '.cm-panels.cm-panels-top': { borderBottom: `1px solid ${border}` },
      '.cm-panels.cm-panels-bottom': { borderTop: `1px solid ${border}` },
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
        backgroundColor: controlBackground,
        color: 'inherit',
        border: `1px solid ${border}`,
        borderRadius: '0.375rem',
        padding: '0.125rem 0.5rem',
        fontSize: '0.8125rem',
      },
      '.cm-textfield:focus': {
        outline: `2px solid ${focus}`,
        outlineOffset: '-1px',
      },
      '.cm-button': { cursor: 'pointer' },
      '.cm-button:active': { backgroundImage: 'none' },
      '.cm-diagnostic': { fontFamily: 'var(--font-ui), sans-serif' },
    })
  );

const catppuccinLatteOverrides: Extension = Prec.high(
  EditorView.theme({
    '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: '#4c4f6912' },
    '.cm-panels': { backgroundColor: '#f5f5f5' },
  })
);

const vscodeDarkOverrides = { foreground: '#d4d4d4' };

export const lightTheme: Extension = [
  catppuccinLatte,
  catppuccinLatteOverrides,
  appOverrides({
    border: '#e5e5e5',
    controlBackground: '#ffffff',
    focus: '#9352ff',
  }),
];

export const darkTheme: Extension = [
  vscodeDarkInit({ settings: vscodeDarkOverrides }),
  appOverrides({
    border: '#404040',
    controlBackground: '#262626',
    focus: '#c8b1ff',
  }),
];
