import type { Directory, File } from '../types';

export type Filesystem = {
  openDirectory: () => Promise<Directory>;
  getSelectedDirectory: () => Promise<Directory | null>;
  listSelectedDirectoryFiles: () => Promise<Array<File>>;
  createNewFile: () => Promise<File>;
  writeFile: (path: string, content: string) => Promise<void>;
  readFile: (path: string) => Promise<File>;
  setSelectedFile: (path: string) => Promise<void>;
  clearFileSelection: () => Promise<void>;
  getSelectedFile: () => Promise<File | null>;
};
