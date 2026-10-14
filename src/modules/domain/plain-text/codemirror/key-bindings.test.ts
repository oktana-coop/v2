import { EditorState } from '@codemirror/state';
import { type Command, EditorView, keymap } from '@codemirror/view';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { caseInsensitiveKeyBindings } from './key-bindings';

const setUpEditor = () => {
  const withoutShift = vi.fn<Command>(() => true);
  const withShift = vi.fn<Command>(() => true);

  const view = new EditorView({
    state: EditorState.create({
      extensions: [
        caseInsensitiveKeyBindings,
        keymap.of([
          { key: 'Ctrl-m', run: withoutShift },
          { key: 'Shift-Ctrl-m', run: withShift },
        ]),
      ],
    }),
    parent: document.body,
  });
  onTestFinished(() => {
    view.destroy();
  });

  return { view, withoutShift, withShift };
};

const pressCtrlM = ({
  view,
  key,
  shiftKey,
}: {
  view: EditorView;
  key: string;
  shiftKey: boolean;
}) =>
  view.contentDOM.dispatchEvent(
    new KeyboardEvent('keydown', {
      key,
      code: 'KeyM',
      keyCode: 77,
      ctrlKey: true,
      shiftKey,
      bubbles: true,
      cancelable: true,
    })
  );

describe('caseInsensitiveKeyBindings', () => {
  it('runs the Shift binding for Ctrl+Shift+M', () => {
    const { view, withoutShift, withShift } = setUpEditor();

    pressCtrlM({ view, key: 'M', shiftKey: true });

    expect(withShift).toHaveBeenCalledOnce();
    expect(withoutShift).not.toHaveBeenCalled();
  });

  it('runs the Shift binding for Ctrl+Shift+M reported as a lowercase letter', () => {
    const { view, withoutShift, withShift } = setUpEditor();

    pressCtrlM({ view, key: 'm', shiftKey: true });

    expect(withShift).toHaveBeenCalledOnce();
    expect(withoutShift).not.toHaveBeenCalled();
  });

  it('runs the binding without Shift for Ctrl+M reported as an uppercase letter', () => {
    const { view, withoutShift, withShift } = setUpEditor();

    pressCtrlM({ view, key: 'M', shiftKey: false });

    expect(withoutShift).toHaveBeenCalledOnce();
    expect(withShift).not.toHaveBeenCalled();
  });
});
