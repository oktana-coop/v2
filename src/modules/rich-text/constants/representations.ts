import type { ValueOf } from 'type-fest';

const AUTOMERGE = 'AUTOMERGE';
const PANDOC = 'PANDOC';
const MARKDOWN = 'MARKDOWN';
const HTML = 'HTML';

export const richTextRepresentations = {
  AUTOMERGE,
  PANDOC,
  MARKDOWN,
  HTML,
} as const;

export type RichTextRepresentation = ValueOf<typeof richTextRepresentations>;
