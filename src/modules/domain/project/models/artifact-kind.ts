import type { ValueOf } from 'type-fest';

const RICH_TEXT_DOCUMENT = 'RICH_TEXT_DOCUMENT';
const ASSET = 'ASSET';

// What a project artifact is, as far as the editor is concerned: something it
// can open and edit, or something a document refers to.
export const artifactKinds = {
  RICH_TEXT_DOCUMENT,
  ASSET,
} as const;

export type ArtifactKind = ValueOf<typeof artifactKinds>;
