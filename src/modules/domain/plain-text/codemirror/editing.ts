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
import { EditorState, type Extension, Prec } from '@codemirror/state';
import {
  type Command,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  type KeyBinding,
  keymap,
  runScopeHandlers,
} from '@codemirror/view';

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

// The letter a shortcut's key stands for, in the case Shift gives it.
const shortcutLetter = (event: KeyboardEvent): string | null => {
  if (!/^[a-z]$/i.test(event.key)) return null;
  if (!(event.ctrlKey || event.metaKey || event.altKey)) return null;

  return event.shiftKey ? event.key.toUpperCase() : event.key.toLowerCase();
};

const withKey = ({
  event,
  key,
}: {
  event: KeyboardEvent;
  key: string;
}): KeyboardEvent =>
  new Proxy(event, {
    get: (target, property) => {
      if (property === 'key') return key;

      const value = Reflect.get(target, property);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });

// Letter shortcuts match by whether Shift is held, whatever the case of the key.
const caseInsensitiveShortcuts = Prec.highest(
  EditorView.domEventHandlers({
    keydown: (event, view) => {
      const key = shortcutLetter(event);
      if (key === null || key === event.key) return false;

      return runScopeHandlers(view, withKey({ event, key }), 'editor');
    },
  })
);

export const editing: Extension = [
  caseInsensitiveShortcuts,
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
