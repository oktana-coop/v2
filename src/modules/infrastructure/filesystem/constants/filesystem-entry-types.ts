import type { ValueOf } from 'type-fest';

const DIRECTORY = 'DIRECTORY';
const FILE = 'FILE';

export const filesystemEntryTypes = {
  DIRECTORY,
  FILE,
} as const;

export type FilesystemEntryType = ValueOf<typeof filesystemEntryTypes>;
