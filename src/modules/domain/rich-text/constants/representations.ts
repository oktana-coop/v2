import type { ValueOf } from 'type-fest';

const AUTOMERGE = 'AUTOMERGE';
const PANDOC = 'PANDOC';
const MARKDOWN = 'MARKDOWN';
const HTML = 'HTML';
const PROSEMIRROR = 'PROSEMIRROR';
const DOCX = 'DOCX';

export const textRichTextRepresentations = {
  AUTOMERGE,
  PANDOC,
  MARKDOWN,
  HTML,
  PROSEMIRROR,
} as const;

export const binaryRichTextRepresentations = { DOCX } as const;

export const richTextRepresentations = {
  ...textRichTextRepresentations,
  ...binaryRichTextRepresentations,
} as const;

export type TextRichTextRepresentation = ValueOf<
  typeof textRichTextRepresentations
>;
export type BinaryRichTextRepresentation = ValueOf<
  typeof binaryRichTextRepresentations
>;
export type RichTextRepresentation = ValueOf<typeof richTextRepresentations>;

export const richTextRepresentationExtensions = {
  AUTOMERGE: 'automerge',
  PANDOC: 'txt',
  MARKDOWN: 'md',
  HTML: 'html',
  PROSEMIRROR: 'json',
  DOCX: 'docx',
};
