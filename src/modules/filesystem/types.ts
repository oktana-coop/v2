import { filesystemItemTypes } from './constants/filesystemItemTypes';

export type FileContent = {
  docUrl: AutomergeUrl;
  value: string;
};

export type FilesystemItem = {
  path?: string;
  name: string;
};

export type Directory = FilesystemItem & {
  type: typeof filesystemItemTypes.DIRECTORY;
  permissionState: PermissionState;
};

export type File = FilesystemItem & {
  type: typeof filesystemItemTypes.FILE;
};

export type FileWithContent = File & {
  content: string;
};
