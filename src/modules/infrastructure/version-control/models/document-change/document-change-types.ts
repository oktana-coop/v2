import type { ValueOf } from 'type-fest';

const ADDED = 'ADDED';
const MODIFIED = 'MODIFIED';
const DELETED = 'DELETED';
const RENAMED = 'RENAMED';

export const documentChangeTypes = {
  ADDED,
  MODIFIED,
  DELETED,
  RENAMED,
} as const;

export type DocumentChangeType = ValueOf<typeof documentChangeTypes>;
