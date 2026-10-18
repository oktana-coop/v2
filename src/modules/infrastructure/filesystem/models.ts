import { filesystemEntryTypes } from './constants/filesystem-entry-types';
import { getDirectoryName } from './utils';

export type FilesystemEntry = {
  path: string;
  name: string;
};

export type Directory = FilesystemEntry & {
  type: typeof filesystemEntryTypes.DIRECTORY;
  permissionState: PermissionState;
  children?: Array<Directory | File>;
};

export type File = FilesystemEntry & {
  type: typeof filesystemEntryTypes.FILE;
  content?: string | Uint8Array;
};

export const toDirectory = ({
  path,
  permissionState = 'granted',
}: {
  path: string;
  permissionState?: PermissionState;
}): Directory => ({
  type: filesystemEntryTypes.DIRECTORY,
  path,
  name: getDirectoryName(path),
  permissionState,
});

export const isDirectory = (entry: Directory | File): entry is Directory =>
  entry.type === filesystemEntryTypes.DIRECTORY;

export const isFile = (entry: Directory | File): entry is File =>
  entry.type === filesystemEntryTypes.FILE;

export type TextFile = File & {
  content: string;
};

export type BinaryFile = File & {
  content: Uint8Array;
};

export const isTextFile = (file: File): file is TextFile =>
  typeof file.content === 'string';

export const isBinaryFile = (file: File): file is BinaryFile =>
  file.content instanceof Uint8Array;
