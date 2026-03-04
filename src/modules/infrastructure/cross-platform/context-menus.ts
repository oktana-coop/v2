export const EXPLORER_TREE_NODE = 'EXPLORER_TREE_NODE';
export const EXPLORER_TREE_FILE = 'EXPLORER_TREE_FILE';
export const EXPLORER_TREE_DIRECTORY = 'EXPLORER_TREE_DIRECTORY';
export const EXPLORER_EMPTY_TREE = 'EXPLORER_EMPTY_TREE';

export type ExplorerTreeNodeContextMenuPayload = {
  context: typeof EXPLORER_TREE_NODE;
  nodeType: 'FILE' | 'DIRECTORY';
  path: string;
};

export type ExplorerEmptyTreeContextMenuPayload = {
  context: typeof EXPLORER_EMPTY_TREE;
};

export type ContextMenuPayload =
  | ExplorerTreeNodeContextMenuPayload
  | ExplorerEmptyTreeContextMenuPayload;

export type ContextMenuAction =
  | {
      context: typeof EXPLORER_TREE_FILE;
      action: ExplorerTreeFileAction;
    }
  | {
      context: typeof EXPLORER_TREE_DIRECTORY;
      action: ExplorerTreeDirectoryAction;
    };

export type ExplorerTreeFileAction =
  | { type: 'RENAME'; path: string }
  | { type: 'DELETE'; path: string };

export type ExplorerTreeDirectoryAction =
  | { type: 'NEW_FILE'; parentPath: string }
  | { type: 'NEW_DIRECTORY'; parentPath: string }
  | { type: 'RENAME'; path: string }
  | { type: 'DELETE'; path: string };
