import { type FilesystemItemType } from '../../../../../../../modules/infrastructure/filesystem';

export const STRUCTURAL_CONFLICTS_NODE_TYPE = 'STRUCTURAL_CONFLICTS' as const;
export const NEW_DIRECTORY_NODE_ID = 'NEW_DIRECTORY' as const;

export type ExplorerTreeNode = {
  id: string;
  name: string;
  type: FilesystemItemType | typeof STRUCTURAL_CONFLICTS_NODE_TYPE;
  children?: ExplorerTreeNode[];
};
