import type { ValueOf } from 'type-fest';

const DIRECTORY = 'DIRECTORY';
const FILE = 'FILE';

export const filesystemItemTypes = {
  DIRECTORY,
  FILE,
} as const;

export type FilesystemItemType = ValueOf<typeof filesystemItemTypes>;
