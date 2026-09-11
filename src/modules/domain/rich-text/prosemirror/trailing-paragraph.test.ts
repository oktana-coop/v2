import { type Node } from 'prosemirror-model';

import { schema } from './schema';
import { doc, editorState, figureWith, heading, hr, para } from './test-utils';
import {
  ensureTrailingParagraphInDoc,
  matchTrailingParagraph,
  stripTrailingParagraphFromDoc,
} from './trailing-paragraph';

const blockTypesOf = (input: Node) =>
  input.content.content.map((node) => node.type.name);

describe('ensureTrailingParagraphInDoc', () => {
  it('appends a paragraph when the last block is a figure', () => {
    const input = doc([heading({ text: 'Foo' }), figureWith({ src: 'a.jpg' })]);
    const fixed = ensureTrailingParagraphInDoc({ doc: input, schema });
    expect(blockTypesOf(fixed)).toEqual(['heading', 'figure', 'paragraph']);
  });

  it('appends a paragraph when the last block is a code_block', () => {
    const codeBlock = schema.node('code_block', null, [schema.text('x')]);
    const fixed = ensureTrailingParagraphInDoc({
      doc: doc([codeBlock]),
      schema,
    });
    expect(blockTypesOf(fixed)).toEqual(['code_block', 'paragraph']);
  });

  it('gives a document without blocks a paragraph', () => {
    // Only an unchecked create yields a doc the schema would reject.
    const fixed = ensureTrailingParagraphInDoc({
      doc: schema.nodes.doc.create(),
      schema,
    });
    expect(blockTypesOf(fixed)).toEqual(['paragraph']);
  });

  it('leaves docs whose last block is a paragraph untouched', () => {
    const input = doc([
      heading({ text: 'Foo' }),
      figureWith({ src: 'a.jpg' }),
      para(),
    ]);
    const fixed = ensureTrailingParagraphInDoc({ doc: input, schema });
    expect(fixed).toBe(input);
  });
});

describe('stripTrailingParagraphFromDoc', () => {
  const needsOne = doc([heading({ text: 'Foo' }), hr()]);
  const needsNone = doc([heading({ text: 'Foo' }), para('bar')]);

  it('inverts ensureTrailingParagraphInDoc', () => {
    for (const input of [needsOne, needsNone]) {
      const ensured = ensureTrailingParagraphInDoc({ doc: input, schema });
      expect(
        stripTrailingParagraphFromDoc({ doc: ensured, schema }).eq(input)
      ).toBe(true);
    }
  });

  it('is inverted by ensureTrailingParagraphInDoc', () => {
    const withParagraph = doc([hr(), para()]);
    for (const input of [withParagraph, needsNone]) {
      const stripped = stripTrailingParagraphFromDoc({ doc: input, schema });
      expect(
        ensureTrailingParagraphInDoc({ doc: stripped, schema }).eq(input)
      ).toBe(true);
    }
  });

  it('keeps an empty paragraph that follows a paragraph', () => {
    const input = doc([para('foo'), para()]);
    expect(stripTrailingParagraphFromDoc({ doc: input, schema })).toBe(input);
  });

  it('keeps the only paragraph of a document', () => {
    const input = doc([para()]);
    expect(stripTrailingParagraphFromDoc({ doc: input, schema })).toBe(input);
  });
});

describe('matchTrailingParagraph', () => {
  it('appends the paragraph the target ends with', () => {
    const target = doc([hr(), para()]);
    const tr = matchTrailingParagraph({
      tr: editorState([hr()]).tr,
      target,
      schema,
    });
    expect(tr.doc.eq(target)).toBe(true);
  });

  it('drops the paragraph the target does not end with', () => {
    const target = doc([hr(), para('b')]);
    const tr = matchTrailingParagraph({
      tr: editorState([hr(), para('b'), para()]).tr,
      target,
      schema,
    });
    expect(tr.doc.eq(target)).toBe(true);
  });

  it('leaves a transaction that already ends like the target alone', () => {
    for (const children of [[hr(), para()], [para('a'), para('b')], [para()]]) {
      const tr = matchTrailingParagraph({
        tr: editorState(children).tr,
        target: doc(children),
        schema,
      });
      expect(tr.docChanged).toBe(false);
    }
  });

  it('never deletes the only block', () => {
    const tr = matchTrailingParagraph({
      tr: editorState([para()]).tr,
      target: doc([para('a')]),
      schema,
    });
    expect(tr.docChanged).toBe(false);
  });
});
