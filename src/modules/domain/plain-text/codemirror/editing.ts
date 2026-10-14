import {
  defaultKeymap,
  history,
  historyKeymap,
  indentLess,
  indentMore,
} from '@codemirror/commands';
import { indentOnInput, indentUnit } from '@codemirror/language';
import { lintKeymap } from '@codemirror/lint';
import { search, searchKeymap } from '@codemirror/search';
import { EditorState, type Extension } from '@codemirror/state';
import {
  type Command,
  highlightActiveLine,
  highlightActiveLineGutter,
  type KeyBinding,
  keymap,
} from '@codemirror/view';

import { caseInsensitiveKeyBindings } from './key-bindings';

// Tab inserts indentation at the caret, or indents the selected lines.
export const indent: Command = (view) => {
  if (view.state.selection.ranges.some((range) => !range.empty)) {
    return indentMore(view);
  }

  view.dispatch(view.state.replaceSelection(view.state.facet(indentUnit)), {
    scrollIntoView: true,
    userEvent: 'input',
  });
  return true;
};

const multipleSelections = EditorState.allowMultipleSelections.of(true);

const tabIndentation: KeyBinding = {
  key: 'Tab',
  run: indent,
  shift: indentLess,
};

export const editing: Extension = [
  caseInsensitiveKeyBindings,
  history(),
  highlightActiveLine(),
  highlightActiveLineGutter(),
  multipleSelections,
  indentOnInput(),
  search({ top: true }),
  keymap.of([
    ...defaultKeymap,
    ...searchKeymap,
    ...historyKeymap,
    ...lintKeymap,
    tabIndentation,
  ]),
];
