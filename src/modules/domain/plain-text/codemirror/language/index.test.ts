import { ensureSyntaxTree, syntaxTree } from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import { classHighlighter, highlightTree } from '@lezer/highlight';
import { describe, expect, it } from 'vitest';

import { type PlainTextLanguage, plainTextLanguages } from '../../models';
import { languageSupport } from './index';

const parse = ({
  text,
  language,
}: {
  text: string;
  language: PlainTextLanguage;
}) => {
  const state = EditorState.create({
    doc: text,
    extensions: languageSupport(language),
  });
  const tree = ensureSyntaxTree(state, text.length, 5000);
  if (!tree) throw new Error('The text was not parsed');

  return tree;
};

// Each highlighted stretch of the text, with the classes it is styled with.
const highlightedIn = ({
  text,
  language,
}: {
  text: string;
  language: PlainTextLanguage;
}) => {
  const highlighted: Array<{ text: string; classes: string }> = [];
  highlightTree(
    parse({ text, language }),
    classHighlighter,
    (from, to, classes) => {
      highlighted.push({ text: text.slice(from, to), classes });
    }
  );

  return highlighted;
};

const parsesJsx = ({
  text,
  language,
}: {
  text: string;
  language: PlainTextLanguage;
}) => parse({ text, language }).toString().includes('JSX');

describe('languageSupport', () => {
  it.each([
    {
      language: plainTextLanguages.JSON,
      text: '{"name": "v2"}',
      expected: [
        { text: '"name"', classes: 'tok-propertyName' },
        { text: '"v2"', classes: 'tok-string' },
      ],
    },
    {
      language: plainTextLanguages.JAVASCRIPT,
      text: 'const app = 1;',
      expected: [{ text: 'const', classes: 'tok-keyword' }],
    },
    {
      language: plainTextLanguages.TYPESCRIPT,
      text: 'let id: string;',
      expected: [{ text: 'string', classes: 'tok-typeName' }],
    },
    {
      language: plainTextLanguages.TSX,
      text: 'let id: string;',
      expected: [{ text: 'string', classes: 'tok-typeName' }],
    },
    {
      language: plainTextLanguages.CSS,
      text: 'p { color: red; }',
      expected: [{ text: 'color', classes: 'tok-propertyName' }],
    },
    {
      language: plainTextLanguages.HTML,
      text: '<p class="note">Hi</p><style>p { color: red; }</style><script>let a = 1;</script>',
      expected: [
        { text: 'class', classes: 'tok-propertyName' },
        { text: 'color', classes: 'tok-propertyName' },
        { text: 'let', classes: 'tok-keyword' },
      ],
    },
  ])('highlights $language', ({ language, text, expected }) => {
    expect(highlightedIn({ text, language })).toEqual(
      expect.arrayContaining(expected)
    );
  });

  it('parses nothing in a plain-text file', () => {
    const state = EditorState.create({
      doc: 'const app = 1;',
      extensions: languageSupport(plainTextLanguages.PLAIN_TEXT),
    });

    expect(syntaxTree(state).length).toBe(0);
  });

  it('parses JSX in JavaScript and in TypeScript with JSX, but not in plain TypeScript', () => {
    const text = 'const value = <App />;';

    expect(parsesJsx({ text, language: plainTextLanguages.JAVASCRIPT })).toBe(
      true
    );
    expect(parsesJsx({ text, language: plainTextLanguages.TSX })).toBe(true);
    expect(parsesJsx({ text, language: plainTextLanguages.TYPESCRIPT })).toBe(
      false
    );
  });
});
