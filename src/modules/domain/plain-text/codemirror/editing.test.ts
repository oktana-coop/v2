import { EditorSelection, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { describe, expect, it, onTestFinished } from 'vitest';

import { editing, indent } from './editing';

const setUpEditor = ({
  text,
  selection,
}: {
  text: string;
  selection: EditorSelection;
}) => {
  const view = new EditorView({
    state: EditorState.create({
      doc: text,
      selection,
      extensions: EditorState.allowMultipleSelections.of(true),
    }),
  });
  onTestFinished(() => {
    view.destroy();
  });

  return view;
};

describe('indent', () => {
  it('inserts indentation at the caret, not at the start of the line', () => {
    const view = setUpEditor({
      text: 'first line\n',
      selection: EditorSelection.single(10),
    });

    indent(view);

    expect(view.state.doc.toString()).toBe('first line  \n');
    expect(view.state.selection.main.head).toBe(12);
  });

  it('indents every line a selection touches', () => {
    const view = setUpEditor({
      text: 'first line\nsecond line\n',
      selection: EditorSelection.single(2, 14),
    });

    indent(view);

    expect(view.state.doc.toString()).toBe('  first line\n  second line\n');
  });

  it('inserts indentation at every caret when there are several', () => {
    const view = setUpEditor({
      text: 'ab\ncd\n',
      selection: EditorSelection.create([
        EditorSelection.cursor(1),
        EditorSelection.cursor(4),
      ]),
    });

    indent(view);

    expect(view.state.doc.toString()).toBe('a  b\nc  d\n');
  });
});

describe('shortcuts', () => {
  const setUpEditingView = () => {
    const view = new EditorView({
      state: EditorState.create({ doc: 'name: v2\n', extensions: editing }),
      parent: document.body,
    });
    onTestFinished(() => {
      view.destroy();
    });

    return view;
  };

  const pressCtrlShiftM = ({ view, key }: { view: EditorView; key: string }) =>
    view.contentDOM.dispatchEvent(
      new KeyboardEvent('keydown', {
        key,
        code: 'KeyM',
        keyCode: 77,
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      })
    );

  it('opens the lint panel with Ctrl+Shift+M', () => {
    const view = setUpEditingView();

    pressCtrlShiftM({ view, key: 'M' });

    expect(view.dom.querySelector('.cm-panel-lint')).not.toBeNull();
  });

  it('opens the lint panel with Ctrl+Shift+M reported as a lowercase letter', () => {
    const view = setUpEditingView();

    pressCtrlShiftM({ view, key: 'm' });

    expect(view.dom.querySelector('.cm-panel-lint')).not.toBeNull();
  });
});
