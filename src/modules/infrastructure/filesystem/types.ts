import { filesystemItemTypes } from './constants/filesystem-item-types';

export type FilesystemItem = {
  path: string;
  name: string;
};

export type Directory = FilesystemItem & {
  type: typeof filesystemItemTypes.DIRECTORY;
  permissionState: PermissionState;
  children?: Array<Directory | File>;
};

export type File = FilesystemItem & {
  type: typeof filesystemItemTypes.FILE;
  content?: string | Uint8Array;
};

export const isDirectory = (item: Directory | File): item is Directory =>
  item.type === filesystemItemTypes.DIRECTORY;

export const isFile = (item: Directory | File): item is File =>
  item.type === filesystemItemTypes.FILE;

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
