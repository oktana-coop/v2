import type { ValueOf } from 'type-fest';

const MULTI_DOCUMENT_PROJECT = 'MULTI_DOCUMENT_PROJECT';
const RICH_TEXT_DOCUMENT = 'RICH_TEXT_DOCUMENT';
const ASSET = 'ASSET';

export const versionedArtifactTypes = {
  MULTI_DOCUMENT_PROJECT,
  RICH_TEXT_DOCUMENT,
  ASSET,
} as const;

export type VersionedArtifactType = ValueOf<typeof versionedArtifactTypes>;
