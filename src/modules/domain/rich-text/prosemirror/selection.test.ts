import { getSelectedText } from './selection';
import { editorState, para, withCursorAt, withSelectionAt } from './test-utils';

describe('getSelectedText', () => {
  it('returns the selected text within a single block', () => {
    const state = withSelectionAt({
      state: editorState([para('hello world')]),
      from: 1,
      to: 6,
    });
    expect(getSelectedText(state)).toBe('hello');
  });

  it('separates blocks with newlines in a multi-block selection', () => {
    const state = withSelectionAt({
      state: editorState([para('hello'), para('world')]),
      from: 1,
      to: 13,
    });
    expect(getSelectedText(state)).toBe('hello\nworld');
  });

  it('returns null for a cursor without a range', () => {
    const state = withCursorAt({
      state: editorState([para('hello')]),
      pos: 2,
    });
    expect(getSelectedText(state)).toBe(null);
  });
});
