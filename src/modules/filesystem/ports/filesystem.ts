import type { Directory, File } from '../types';

export type Filesystem = {
  openDirectory: () => Promise<Directory>;
  getDirectory: (path: string) => Promise<Directory | null>;
  listDirectoryFiles: (path: string) => Promise<Array<File>>;
  requestPermissionForDirectory: (path: string) => Promise<PermissionState>;
  createNewFile: (suggestedName: string) => Promise<File>;
  writeFile: (path: string, content: string) => Promise<void>;
  readFile: (path: string) => Promise<File>;
};
