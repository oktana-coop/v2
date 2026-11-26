import { bracketMatching } from '@codemirror/language';
import { highlightSelectionMatches } from '@codemirror/search';
import { EditorState, type Extension } from '@codemirror/state';
import {
  drawSelection,
  EditorView,
  highlightSpecialChars,
  lineNumbers,
} from '@codemirror/view';

export const display: Extension = [
  lineNumbers(),
  highlightSpecialChars(),
  drawSelection(),
  bracketMatching(),
  highlightSelectionMatches(),
];

export const readOnly: Extension = [
  EditorState.readOnly.of(true),
  EditorView.editable.of(false),
];
