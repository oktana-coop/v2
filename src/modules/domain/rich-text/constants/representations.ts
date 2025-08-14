import type { ValueOf } from 'type-fest';

const AUTOMERGE = 'AUTOMERGE';
const PANDOC = 'PANDOC';
const MARKDOWN = 'MARKDOWN';
const HTML = 'HTML';
const PROSEMIRROR = 'PROSEMIRROR';
const DOCX = 'DOCX';
const PDF = 'PDF';

export const richTextRepresentations = {
  AUTOMERGE,
  PANDOC,
  MARKDOWN,
  HTML,
  PROSEMIRROR,
  DOCX,
  PDF,
} as const;

export type RichTextRepresentation = ValueOf<typeof richTextRepresentations>;

export const richTextRepresentationExtensions = {
  AUTOMERGE: 'automerge',
  PANDOC: 'txt',
  MARKDOWN: 'md',
  HTML: 'html',
  PROSEMIRROR: 'json',
  DOCX: 'docx',
  PDF: 'pdf',
};
