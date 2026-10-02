import { type FilesystemEntryType } from '../../../../../../../modules/infrastructure/filesystem';

export const STRUCTURAL_CONFLICTS_NODE_TYPE = 'STRUCTURAL_CONFLICTS' as const;
export const NEW_DIRECTORY_NODE_ID = 'NEW_DIRECTORY' as const;
export const NEW_FILE_NODE_ID = 'NEW_FILE' as const;

export type ExplorerTreeNode = {
  id: string;
  name: string;
  type: FilesystemEntryType | typeof STRUCTURAL_CONFLICTS_NODE_TYPE;
  children?: ExplorerTreeNode[];
  shared: boolean;
};

// A file or folder being named in the tree, before it exists on disk.
export type PendingTreeEntry = {
  type: FilesystemEntryType;
  parentPath?: string;
  // What the name field starts with.
  name?: string;
};
