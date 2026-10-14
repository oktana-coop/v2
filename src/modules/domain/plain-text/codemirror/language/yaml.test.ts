import { ensureSyntaxTree } from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import { classHighlighter, highlightTree } from '@lezer/highlight';
import { describe, expect, it } from 'vitest';

import { yamlSupport } from './yaml';

// Each highlighted stretch of the text, with the classes it is styled with.
const highlightedIn = (text: string) => {
  const state = EditorState.create({
    doc: text,
    extensions: yamlSupport,
  });
  const tree = ensureSyntaxTree(state, text.length);
  if (!tree) throw new Error('The text was not parsed');

  const highlighted: Array<{ text: string; classes: string }> = [];
  highlightTree(tree, classHighlighter, (from, to, classes) => {
    highlighted.push({ text: text.slice(from, to), classes });
  });

  return highlighted;
};

describe('yamlSupport', () => {
  it('highlights unquoted YAML values as strings, and keys as keys', () => {
    expect(highlightedIn('name: v2\n')).toEqual(
      expect.arrayContaining([
        { text: 'name', classes: 'tok-propertyName tok-definition' },
        { text: 'v2', classes: 'tok-string' },
      ])
    );
  });

  it('highlights the content of YAML block scalars as strings', () => {
    expect(highlightedIn('notes: |\n  first line\n')).toEqual(
      expect.arrayContaining([{ text: '  first line', classes: 'tok-string' }])
    );
  });
});
