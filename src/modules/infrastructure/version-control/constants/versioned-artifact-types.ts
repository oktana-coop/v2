import type { ValueOf } from 'type-fest';

const PROJECT = 'PROJECT';
const RICH_TEXT_DOCUMENT = 'RICH_TEXT_DOCUMENT';
const ASSET = 'ASSET';

export const versionedArtifactTypes = {
  PROJECT,
  RICH_TEXT_DOCUMENT,
  ASSET,
} as const;

export type VersionedArtifactType = ValueOf<typeof versionedArtifactTypes>;
