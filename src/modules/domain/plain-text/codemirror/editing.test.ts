import { EditorSelection, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { describe, expect, it, onTestFinished } from 'vitest';

import { indent } from './editing';

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
