import type { ValueOf } from 'type-fest';

const AUTOMERGE = 'AUTOMERGE';
const PANDOC = 'PANDOC';
const MARKDOWN = 'MARKDOWN';
const HTML = 'HTML';
const PROSEMIRROR = 'PROSEMIRROR';
const DOCX = 'DOCX';

export const richTextRepresentations = {
  AUTOMERGE,
  PANDOC,
  MARKDOWN,
  HTML,
  PROSEMIRROR,
  DOCX,
} as const;

export type RichTextRepresentation = ValueOf<typeof richTextRepresentations>;

export const richTextRepresentationExtensions = {
  AUTOMERGE: 'automerge',
  PANDOC: 'txt',
  MARKDOWN: 'md',
  HTML: 'html',
  PROSEMIRROR: 'json',
  DOCX: 'docx',
};
