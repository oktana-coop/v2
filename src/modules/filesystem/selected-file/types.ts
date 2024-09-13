import { AutomergeUrl } from '../../version-control';

export type FileInfo = {
  automergeUrl: AutomergeUrl;
  fileHandle: FileSystemFileHandle;
};
