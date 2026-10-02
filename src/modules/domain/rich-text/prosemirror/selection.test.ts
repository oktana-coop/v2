import { type Node as ProseMirrorNode } from 'prosemirror-model';
import { EditorState, NodeSelection, TextSelection } from 'prosemirror-state';

import { schema } from './schema';
import { docFromSelection, getSelectedText } from './selection';
import {
  editorState,
  figureWith,
  heading,
  para,
  topLevelTypes,
  withCursorAt,
  withSelectionAt,
} from './test-utils';

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

const listItem = (children: ProseMirrorNode[]): ProseMirrorNode =>
  schema.node('list_item', null, children);

const bulletList = (items: ProseMirrorNode[]): ProseMirrorNode =>
  schema.node('bullet_list', null, items);

const orderedList = (items: ProseMirrorNode[]): ProseMirrorNode =>
  schema.node('ordered_list', { order: 1 }, items);

const blockquote = (children: ProseMirrorNode[]): ProseMirrorNode =>
  schema.node('blockquote', null, children);

const codeBlock = (text: string, language = 'python'): ProseMirrorNode =>
  schema.node('code_block', { language }, [schema.text(text)]);

// Absolute position of the first occurrence of `text` in the doc.
const posOf = (docNode: ProseMirrorNode, text: string): number => {
  let result = -1;
  docNode.descendants((node, pos) => {
    if (result !== -1) return false;
    if (node.isText && node.text!.includes(text)) {
      result = pos + node.text!.indexOf(text);
    }
    return result === -1;
  });
  if (result === -1) throw new Error(`Text not found in doc: ${text}`);
  return result;
};

// Selects from the start of `fromText` to the end of `toText` (defaults to
// `fromText`, i.e. selects that text).
const selectText = (
  state: EditorState,
  fromText: string,
  toText = fromText
): EditorState => {
  const from = posOf(state.doc, fromText);
  const to = posOf(state.doc, toText) + toText.length;
  return state.apply(
    state.tr.setSelection(TextSelection.create(state.doc, from, to))
  );
};

const selectNode = (state: EditorState, typeName: string): EditorState => {
  let nodePos = -1;
  state.doc.descendants((node, pos) => {
    if (nodePos !== -1) return false;
    if (node.type.name === typeName) {
      nodePos = pos;
    }
    return nodePos === -1;
  });
  return state.apply(
    state.tr.setSelection(NodeSelection.create(state.doc, nodePos))
  );
};

describe('docFromSelection', () => {
  it('returns null for an empty selection', () => {
    const state = withCursorAt({ state: editorState([para('hello')]), pos: 2 });
    expect(docFromSelection(state)).toBeNull();
  });

  it('copies a word from a paragraph as a bare paragraph', () => {
    const state = selectText(editorState([para('hello world')]), 'hello');
    const result = docFromSelection(state)!;
    expect(result.content.content.map((n) => n.type.name)).toEqual([
      'paragraph',
    ]);
    expect(result.textContent).toBe('hello');
  });

  it('keeps both blocks when the selection spans two paragraphs', () => {
    const state = selectText(
      editorState([para('first'), para('second')]),
      'rst',
      'se'
    );
    const result = docFromSelection(state)!;
    expect(result.content.content.map((n) => n.type.name)).toEqual([
      'paragraph',
      'paragraph',
    ]);
    expect(result.textContent).toBe('rstse');
  });

  it('keeps a heading partially covered by a cross-block selection', () => {
    const state = selectText(
      editorState([heading({ text: 'Head' }), para('body')]),
      'ead',
      'bo'
    );
    const result = docFromSelection(state)!;
    expect(result.content.content.map((n) => n.type.name)).toEqual([
      'heading',
      'paragraph',
    ]);
  });

  it('keeps the heading (and its level) for a selection inside it', () => {
    const state = selectText(
      editorState([heading({ text: 'Title here', level: 2 })]),
      'Title'
    );
    const result = docFromSelection(state)!;
    expect(result.firstChild!.type.name).toBe('heading');
    expect(result.firstChild!.attrs.level).toBe(2);
    expect(result.textContent).toBe('Title');
  });

  it('keeps the bullet list when the selection spans two of its items', () => {
    const state = selectText(
      editorState([
        bulletList([listItem([para('one')]), listItem([para('two')])]),
      ]),
      'ne',
      't'
    );
    const result = docFromSelection(state)!;
    expect(result.content.content.map((n) => n.type.name)).toEqual([
      'bullet_list',
    ]);
    expect(result.firstChild!.childCount).toBe(2);
    expect(result.textContent).toBe('net');
  });

  it('does not turn a partially selected ordered list into another list type', () => {
    const state = selectText(
      editorState([
        orderedList([listItem([para('one')]), listItem([para('two')])]),
      ]),
      'ne',
      't'
    );
    const result = docFromSelection(state)!;
    expect(result.firstChild!.type.name).toBe('ordered_list');
  });

  it('drops the list for a selection inside a single item', () => {
    const state = selectText(
      editorState([
        bulletList([listItem([para('one')]), listItem([para('two')])]),
      ]),
      'ne'
    );
    const result = docFromSelection(state)!;
    expect(result.content.content.map((n) => n.type.name)).toEqual([
      'paragraph',
    ]);
    expect(result.textContent).toBe('ne');
  });

  it('drops the blockquote when its paragraphs are selected from within', () => {
    const state = selectText(
      editorState([blockquote([para('aa'), para('bb')])]),
      'aa',
      'bb'
    );
    const result = docFromSelection(state)!;
    expect(result.content.content.map((n) => n.type.name)).toEqual([
      'paragraph',
      'paragraph',
    ]);
  });

  it('keeps a partially selected code block, including its language', () => {
    const state = selectText(editorState([codeBlock('print hello')]), 'print');
    const result = docFromSelection(state)!;
    expect(result.firstChild!.type.name).toBe('code_block');
    expect(result.firstChild!.attrs.language).toBe('python');
    expect(result.textContent).toBe('print');
  });

  it('copies a node selection (figure) as-is', () => {
    const state = selectNode(
      editorState([para('x'), figureWith({ src: 'a.jpg' })]),
      'figure'
    );
    const result = docFromSelection(state)!;
    expect(topLevelTypes(state)).toEqual(['paragraph', 'figure']);
    expect(result.content.content.map((n) => n.type.name)).toEqual(['figure']);
  });

  it('falls back to plain text when the cut cannot be closed into a valid doc', () => {
    // Selecting from a list item's trailing code block into the next item
    // leaves the first item without its required leading paragraph.
    const state = editorState([
      bulletList([
        listItem([para('a'), codeBlock('bb')]),
        listItem([para('c')]),
      ]),
    ]);
    const from = posOf(state.doc, 'bb') + 1;
    const to = posOf(state.doc, 'c') + 1;
    const selected = state.apply(
      state.tr.setSelection(TextSelection.create(state.doc, from, to))
    );
    const result = docFromSelection(selected)!;
    expect(result.content.content.map((n) => n.type.name)).toEqual([
      'paragraph',
      'paragraph',
    ]);
    expect(result.textContent).toBe('bc');
    result.check();
  });
});
