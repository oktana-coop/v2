import { AutomergeUrl } from '@automerge/automerge-repo';

export type FileInfo = {
  automergeUrl: AutomergeUrl;
  fileHandle: FileSystemFileHandle;
};
