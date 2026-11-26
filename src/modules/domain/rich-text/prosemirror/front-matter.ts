import { type Node } from 'prosemirror-model';

export const getDocFrontMatter = (doc: Node): string | null => {
  const frontMatter: unknown = doc.attrs.frontMatter;

  return typeof frontMatter === 'string' ? frontMatter : null;
};
