import { ensureTrailingParagraphInDoc } from './blocks';
import { schema } from './schema';

const buildDoc = (children: ReturnType<typeof schema.node>[]) =>
  schema.node('doc', { pandocMeta: null }, children);

const image = (src: string) =>
  schema.node('image', { src, alt: null, title: null });

const figureWith = (src: string) =>
  schema.node('figure', null, [
    schema.node('figure_content', null, [image(src)]),
  ]);

const heading = (text: string) =>
  schema.node('heading', { level: 1 }, [schema.text(text)]);

const para = (text?: string) =>
  schema.node('paragraph', null, text ? [schema.text(text)] : []);

describe('ensureTrailingParagraphInDoc', () => {
  it('appends a paragraph when the last block is a figure', () => {
    const doc = buildDoc([heading('Foo'), figureWith('a.jpg')]);
    const fixed = ensureTrailingParagraphInDoc(doc, schema);
    const types = fixed.content.content.map((n) => n.type.name);
    expect(types).toEqual(['heading', 'figure', 'paragraph']);
  });

  it('appends a paragraph when the last block is a code_block', () => {
    const codeBlock = schema.node('code_block', null, [schema.text('x')]);
    const doc = buildDoc([codeBlock]);
    const fixed = ensureTrailingParagraphInDoc(doc, schema);
    expect(fixed.content.content.map((n) => n.type.name)).toEqual([
      'code_block',
      'paragraph',
    ]);
  });

  it('leaves docs whose last block is a paragraph untouched', () => {
    const doc = buildDoc([heading('Foo'), figureWith('a.jpg'), para()]);
    const fixed = ensureTrailingParagraphInDoc(doc, schema);
    expect(fixed).toBe(doc);
  });
});
