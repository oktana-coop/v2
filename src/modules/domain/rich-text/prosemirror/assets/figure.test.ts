import {
  EditorState,
  NodeSelection,
  TextSelection,
  type Transaction,
} from 'prosemirror-state';
import { vi } from 'vitest';

import { parseAssetDocRelPath } from '../../models';
import { schema } from '../schema';
import {
  editorState,
  fakeView,
  figureWith,
  heading,
  para,
  runCommand,
  topLevelTypes,
  withCursorAt,
} from '../test-utils';
import {
  canInsertFigure,
  deleteFigureAfterCursor,
  deleteFigureBeforeCursor,
  type FigureAssetPicker,
  insertFigure,
  moveToParagraphAfterSelectedFigure,
  pickAndInsertFigure,
  removeEmptyFiguresPlugin,
} from './figure';

describe('removeEmptyFiguresPlugin', () => {
  const withPlugin = (children: Parameters<typeof editorState>[0]) =>
    editorState(children, [removeEmptyFiguresPlugin(schema)]);

  it('removes a figure once its image is deleted', () => {
    const state = withPlugin([figureWith('a.jpg'), para()]);
    // The image sits at doc pos 2 (figure open + figure_content open).
    const next = state.apply(state.tr.delete(2, 3));
    expect(topLevelTypes(next)).toEqual(['paragraph']);
  });

  it('leaves a figure with an image untouched while typing', () => {
    const state = withPlugin([figureWith('a.jpg'), para()]);
    // Insert into the trailing paragraph (its content starts at pos 6).
    const next = state.apply(state.tr.insertText('a', 6));
    expect(topLevelTypes(next)).toEqual(['figure', 'paragraph']);
    expect(next.doc.firstChild?.firstChild?.firstChild?.type.name).toBe(
      'image'
    );
  });

  it('removes multiple emptied figures and keeps surrounding content', () => {
    const state = withPlugin([
      figureWith('a.jpg'),
      figureWith('b.jpg'),
      para('xy'),
    ]);
    // Delete both images in one transaction (img2 at 7, img1 at 2),
    // bottom-up so the earlier offset stays valid.
    const next = state.apply(state.tr.delete(7, 8).delete(2, 3));
    expect(topLevelTypes(next)).toEqual(['paragraph']);
    expect(next.doc.textContent).toBe('xy');
  });
});

describe('moveToParagraphAfterSelectedFigure', () => {
  // The figure sits at the doc start, so selecting it is a NodeSelection at 0.
  const selectFigure = (state: EditorState) =>
    state.apply(state.tr.setSelection(NodeSelection.create(state.doc, 0)));

  const run = (state: EditorState) =>
    runCommand({ state, command: moveToParagraphAfterSelectedFigure });

  it('moves the cursor into the existing paragraph below the figure', () => {
    const { handled, next } = run(
      selectFigure(editorState([figureWith('a.jpg'), para()]))
    );

    expect(handled).toBe(true);
    // The trailing paragraph is reused — none is inserted.
    expect(topLevelTypes(next)).toEqual(['figure', 'paragraph']);
    expect(next.selection.$from.parent.type.name).toBe('paragraph');
    // Cursor lands just inside that paragraph (figure spans 0–5, para at 5).
    expect(next.selection.from).toBe(6);
  });

  it('inserts a paragraph when none follows the figure', () => {
    const { handled, next } = run(
      selectFigure(editorState([figureWith('a.jpg')]))
    );

    expect(handled).toBe(true);
    expect(topLevelTypes(next)).toEqual(['figure', 'paragraph']);
    expect(next.selection.$from.parent.type.name).toBe('paragraph');
    expect(next.selection.from).toBe(6);
  });

  it('returns false when no figure is selected', () => {
    const { handled } = run(editorState([para('hi')]));
    expect(handled).toBe(false);
  });
});

describe('deleteFigureBeforeCursor', () => {
  it('deletes the figure when the cursor is at the start of the next block', () => {
    // figure spans 0–5, paragraph starts at 5, its content at pos 6.
    const state = withCursorAt({
      state: editorState([figureWith('a.jpg'), para('hi')]),
      pos: 6,
    });
    const { handled, next } = runCommand({
      state,
      command: deleteFigureBeforeCursor,
    });

    expect(handled).toBe(true);
    expect(topLevelTypes(next)).toEqual(['paragraph']);
    expect(next.doc.textContent).toBe('hi');
  });

  it('returns false mid-paragraph', () => {
    const state = withCursorAt({
      state: editorState([figureWith('a.jpg'), para('hi')]),
      pos: 7,
    });
    expect(
      runCommand({ state, command: deleteFigureBeforeCursor }).handled
    ).toBe(false);
  });

  it('returns false when the preceding block is not a figure', () => {
    // para('x') spans 0–3, the second paragraph's content starts at pos 4.
    const state = withCursorAt({
      state: editorState([para('x'), para('hi')]),
      pos: 4,
    });
    expect(
      runCommand({ state, command: deleteFigureBeforeCursor }).handled
    ).toBe(false);
  });
});

describe('deleteFigureAfterCursor', () => {
  it('deletes the figure when the cursor is at the end of the previous block', () => {
    // para('hi') spans 0–4, its content ends at pos 3; figure follows at 4.
    const state = withCursorAt({
      state: editorState([para('hi'), figureWith('a.jpg')]),
      pos: 3,
    });
    const { handled, next } = runCommand({
      state,
      command: deleteFigureAfterCursor,
    });

    expect(handled).toBe(true);
    expect(topLevelTypes(next)).toEqual(['paragraph']);
    expect(next.doc.textContent).toBe('hi');
  });

  it('returns false mid-paragraph', () => {
    const state = withCursorAt({
      state: editorState([para('hi'), figureWith('a.jpg')]),
      pos: 2,
    });
    expect(
      runCommand({ state, command: deleteFigureAfterCursor }).handled
    ).toBe(false);
  });

  it('returns false when the following block is not a figure', () => {
    const state = withCursorAt({
      state: editorState([para('hi'), para('x')]),
      pos: 3,
    });
    expect(
      runCommand({ state, command: deleteFigureAfterCursor }).handled
    ).toBe(false);
  });
});

describe('canInsertFigure', () => {
  it('is true with the cursor in an empty paragraph', () => {
    expect(canInsertFigure(editorState([para()]))).toBe(true);
  });

  it('is false in a non-empty paragraph', () => {
    expect(canInsertFigure(editorState([para('hi')]))).toBe(false);
  });

  it('is false in a non-paragraph block', () => {
    expect(canInsertFigure(editorState([heading()]))).toBe(false);
  });

  it('is false when the selection is not empty', () => {
    const state = editorState([para('hello')]);
    const selected = state.apply(
      state.tr.setSelection(TextSelection.create(state.doc, 1, 4))
    );
    expect(canInsertFigure(selected)).toBe(false);
  });
});

describe('insertFigure', () => {
  it('replaces an empty paragraph with a figure and selects it', () => {
    const state = editorState([para()]);
    const { handled, next } = runCommand({
      state,
      command: insertFigure({ src: 'a.jpg' }),
    });

    expect(handled).toBe(true);
    expect(topLevelTypes(next)).toEqual(['figure']);
    expect(next.selection).toBeInstanceOf(NodeSelection);
    expect((next.selection as NodeSelection).node.type.name).toBe('figure');
    expect(next.doc.firstChild?.firstChild?.firstChild?.attrs.src).toBe(
      'a.jpg'
    );
  });

  it('returns false when insertion is not allowed', () => {
    const state = editorState([para('hi')]);
    const { handled, next } = runCommand({
      state,
      command: insertFigure({ src: 'a.jpg' }),
    });

    expect(handled).toBe(false);
    expect(topLevelTypes(next)).toEqual(['paragraph']);
  });
});

describe('pickAndInsertFigure', () => {
  it('inserts a figure from the picked asset', async () => {
    const state = editorState([para()]);
    const { view, dispatch } = fakeView(state);
    const pickAsset: FigureAssetPicker = vi.fn(async () => ({
      src: parseAssetDocRelPath('a.jpg'),
      alt: null,
      title: null,
    }));

    const handled = await pickAndInsertFigure(pickAsset)(view);

    expect(handled).toBe(true);
    expect(pickAsset).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledTimes(1);
    const next = state.apply(dispatch.mock.calls[0][0] as Transaction);
    expect(topLevelTypes(next)).toEqual(['figure']);
  });

  it('does nothing when the picker is cancelled', async () => {
    const state = editorState([para()]);
    const { view, dispatch } = fakeView(state);
    const pickAsset: FigureAssetPicker = vi.fn(async () => null);

    const handled = await pickAndInsertFigure(pickAsset)(view);

    expect(handled).toBe(false);
    expect(pickAsset).toHaveBeenCalledTimes(1);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('never invokes the picker when insertion is not allowed', () => {
    const state = editorState([para('hi')]);
    const { view, dispatch } = fakeView(state);
    const pickAsset: FigureAssetPicker = vi.fn(async () => ({
      src: parseAssetDocRelPath('a.jpg'),
      alt: null,
      title: null,
    }));

    // Synchronous guard returns before awaiting the picker.
    const result = pickAndInsertFigure(pickAsset)(view);

    expect(pickAsset).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
    return expect(result).resolves.toBe(false);
  });
});
