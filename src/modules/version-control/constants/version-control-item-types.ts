import type { ValueOf } from 'type-fest';

const PROJECT = 'PROJECT';
const RICH_TEXT_DOCUMENT = 'RICH_TEXT_DOCUMENT';

export const versionControlItemTypes = {
  PROJECT,
  RICH_TEXT_DOCUMENT,
} as const;

export type VersionControlItemType = ValueOf<typeof versionControlItemTypes>;
