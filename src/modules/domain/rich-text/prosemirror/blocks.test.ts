import { ensureTrailingParagraphInDoc } from './blocks';
import { schema } from './schema';
import { doc, figureWith, heading, para } from './test-utils';

describe('ensureTrailingParagraphInDoc', () => {
  it('appends a paragraph when the last block is a figure', () => {
    const input = doc([heading({ text: 'Foo' }), figureWith({ src: 'a.jpg' })]);
    const fixed = ensureTrailingParagraphInDoc(input, schema);
    expect(fixed.content.content.map((n) => n.type.name)).toEqual([
      'heading',
      'figure',
      'paragraph',
    ]);
  });

  it('appends a paragraph when the last block is a code_block', () => {
    const codeBlock = schema.node('code_block', null, [schema.text('x')]);
    const fixed = ensureTrailingParagraphInDoc(doc([codeBlock]), schema);
    expect(fixed.content.content.map((n) => n.type.name)).toEqual([
      'code_block',
      'paragraph',
    ]);
  });

  it('leaves docs whose last block is a paragraph untouched', () => {
    const input = doc([heading({ text: 'Foo' }), figureWith({ src: 'a.jpg' }), para()]);
    const fixed = ensureTrailingParagraphInDoc(input, schema);
    expect(fixed).toBe(input);
  });
});
