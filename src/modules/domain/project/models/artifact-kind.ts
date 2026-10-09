import type { ValueOf } from 'type-fest';

const RICH_TEXT_DOCUMENT = 'RICH_TEXT_DOCUMENT';
const BINARY_FILE = 'BINARY_FILE';

export const artifactKinds = {
  RICH_TEXT_DOCUMENT,
  BINARY_FILE,
} as const;

export type ArtifactKind = ValueOf<typeof artifactKinds>;

export const canReferenceAssets = (kind: ArtifactKind): boolean =>
  kind === artifactKinds.RICH_TEXT_DOCUMENT;
