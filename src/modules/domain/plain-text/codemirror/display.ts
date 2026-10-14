import { bracketMatching } from '@codemirror/language';
import { highlightSelectionMatches } from '@codemirror/search';
import { type Extension } from '@codemirror/state';
import {
  drawSelection,
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
