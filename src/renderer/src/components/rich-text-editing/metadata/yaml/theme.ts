import { Prec } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

export const fittedToText = Prec.highest(
  EditorView.theme({
    '.cm-content': { paddingTop: '0', paddingBottom: '0.5rem' },
  })
);
