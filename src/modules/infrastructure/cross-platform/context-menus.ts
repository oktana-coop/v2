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
  | ExplorerEmptyTreeContextMenuPayload
  | GuestShareContextMenuPayload;

export type ContextMenuAction =
  | {
      context: typeof EXPLORER_TREE_FILE;
      action: ExplorerTreeFileAction;
    }
  | {
      context: typeof EXPLORER_TREE_DIRECTORY;
      action: ExplorerTreeDirectoryAction;
    }
  | GuestShareContextMenuAction;

export type ExplorerTreeFileAction =
  { type: 'RENAME'; path: string } | { type: 'DELETE'; path: string };

export type ExplorerTreeDirectoryAction =
  | { type: 'NEW_FILE'; parentPath: string }
  | { type: 'NEW_DIRECTORY'; parentPath: string }
  | { type: 'RENAME'; path: string }
  | { type: 'DELETE'; path: string };

// A shared document held without its project, as listed in "Shared with me".
export const GUEST_SHARE = 'GUEST_SHARE';

export type GuestShareContextMenuPayload = {
  context: typeof GUEST_SHARE;
  shareId: string;
};

export type GuestShareAction =
  { type: 'RENAME'; shareId: string } | { type: 'LEAVE'; shareId: string };

export type GuestShareContextMenuAction = {
  context: typeof GUEST_SHARE;
  action: GuestShareAction;
};
