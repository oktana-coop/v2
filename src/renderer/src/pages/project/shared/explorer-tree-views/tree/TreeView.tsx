import { createContext, useContext, useRef } from 'react';
import { type NodeApi, Tree, type TreeApi } from 'react-arborist';
import { AutoSizer } from 'react-virtualized-auto-sizer';

import { ElectronContext } from '../../../../../../../modules/infrastructure/cross-platform/browser';
import { filesystemItemTypes } from '../../../../../../../modules/infrastructure/filesystem';
import {
  type ExplorerTreeNode,
  STRUCTURAL_CONFLICTS_NODE_TYPE,
} from '../../../../../hooks';
import { TreeNode } from './TreeNode';

// Provides callbacks to node renderers without requiring prop-drilling
// through react-arborist's renderer boundary.
type TreeCallbacks = {
  onCreateDirectory: (name: string) => Promise<void>;
  onCancelCreateDirectory: () => void;
  onRenameDocument: (oldPath: string, newName: string) => Promise<void>;
  onCancelRenameDocument: () => void;
  onClearRenameDocumentError: () => void;
  filePathToRename: string | null;
  renameDocumentError: string | null;
  onRenameDirectory: (oldPath: string, newName: string) => Promise<void>;
  onCancelRenameDirectory: () => void;
  onClearRenameDirectoryError: () => void;
  directoryPathToRename: string | null;
  renameDirectoryError: string | null;
};

const TreeCallbacksContext = createContext<TreeCallbacks>({
  onCreateDirectory: async () => {},
  onCancelCreateDirectory: () => {},
  onRenameDocument: async () => {},
  onCancelRenameDocument: () => {},
  onClearRenameDocumentError: () => {},
  filePathToRename: null,
  renameDocumentError: null,
  onRenameDirectory: async () => {},
  onCancelRenameDirectory: () => {},
  onClearRenameDirectoryError: () => {},
  directoryPathToRename: null,
  renameDirectoryError: null,
});

export const useTreeCallbacks = () => useContext(TreeCallbacksContext);

export const TreeView = ({
  data,
  selection,
  onSelectItem,
  onCreateDirectory = async () => {},
  onCancelCreateDirectory = () => {},
  onStartRenameDocument,
  onRenameDocument = async () => {},
  onCancelRenameDocument = () => {},
  onClearRenameDocumentError = () => {},
  filePathToRename = null,
  renameDocumentError = null,
  onStartRenameDirectory,
  onRenameDirectory = async () => {},
  onCancelRenameDirectory = () => {},
  onClearRenameDirectoryError = () => {},
  directoryPathToRename = null,
  renameDirectoryError = null,
  onStartDeleteDocument,
  onStartDeleteDirectory,
  onCreateNewFile,
  onStartCreateDirectory,
  hasPendingNewDirectory = false,
}: {
  data: ExplorerTreeNode[];
  selection: string | null;
  onSelectItem: (id: string) => Promise<void>;
  onCreateDirectory?: (name: string) => Promise<void>;
  onCancelCreateDirectory?: () => void;
  onStartRenameDocument?: (path: string) => void;
  onRenameDocument?: (oldPath: string, newName: string) => Promise<void>;
  onCancelRenameDocument?: () => void;
  onClearRenameDocumentError?: () => void;
  filePathToRename?: string | null;
  renameDocumentError?: string | null;
  onStartRenameDirectory?: (path: string) => void;
  onRenameDirectory?: (oldPath: string, newName: string) => Promise<void>;
  onCancelRenameDirectory?: () => void;
  onClearRenameDirectoryError?: () => void;
  directoryPathToRename?: string | null;
  renameDirectoryError?: string | null;
  onStartDeleteDocument?: (path: string) => void;
  onStartDeleteDirectory?: (path: string) => void;
  onCreateNewFile?: (parentPath?: string) => Promise<void>;
  onStartCreateDirectory?: (parentPath?: string) => void;
  hasPendingNewDirectory?: boolean;
}) => {
  const { isMac } = useContext(ElectronContext);
  const treeRef = useRef<TreeApi<ExplorerTreeNode>>(null);

  const handleActivate = (node: NodeApi<ExplorerTreeNode>) => {
    if (
      node.data.type === filesystemItemTypes.FILE ||
      node.data.type === STRUCTURAL_CONFLICTS_NODE_TYPE
    ) {
      onSelectItem(node.id);
    }
  };

  const getNewFileParentPath = (
    focused: NodeApi<ExplorerTreeNode> | null
  ): string | undefined => {
    if (!focused) return undefined;
    if (focused.data.type === filesystemItemTypes.DIRECTORY) return focused.id;
    const parentId = focused.parent?.id;
    if (!parentId || focused.parent?.isRoot) return undefined;
    return parentId;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (filePathToRename || directoryPathToRename || hasPendingNewDirectory)
      return;

    const modKey = isMac ? e.metaKey : e.ctrlKey;
    const isNewFileKey = e.key === 'n' && modKey && !e.shiftKey && !e.altKey;
    const isNewDirectoryKey =
      e.code === 'KeyN' && modKey && !e.shiftKey && e.altKey;
    const isDeleteKey = e.key === 'Backspace' && modKey;
    const isRenameKey = isMac ? e.key === 'Enter' : e.key === 'F2';

    if (!isNewFileKey && !isNewDirectoryKey && !isDeleteKey && !isRenameKey)
      return;

    const focused = treeRef.current?.focusedNode ?? null;

    // New file: works with or without a focused node
    if (isNewFileKey && onCreateNewFile) {
      e.preventDefault();
      e.stopPropagation();
      onCreateNewFile(getNewFileParentPath(focused));
      return;
    }

    // New directory: works with or without a focused node
    if (isNewDirectoryKey && onStartCreateDirectory) {
      e.preventDefault();
      e.stopPropagation();

      const parentPath = getNewFileParentPath(focused);
      if (parentPath) {
        // Expand the parent directory
        treeRef.current?.open(parentPath);
      }
      onStartCreateDirectory(parentPath);

      return;
    }

    // Delete and rename require a focused node
    if (!focused) return;

    const isFile = focused.data.type === filesystemItemTypes.FILE;
    const isDirectory = focused.data.type === filesystemItemTypes.DIRECTORY;

    const action = isDeleteKey
      ? // Delete
        (isFile && onStartDeleteDocument) ||
        (isDirectory && onStartDeleteDirectory)
      : // Rename
        (isFile && onStartRenameDocument) ||
        (isDirectory && onStartRenameDirectory);

    if (!action) return;

    e.preventDefault();
    e.stopPropagation();
    action(focused.id);
  };

  return (
    <TreeCallbacksContext.Provider
      value={{
        onCreateDirectory,
        onCancelCreateDirectory,
        onRenameDocument,
        onCancelRenameDocument,
        onClearRenameDocumentError,
        filePathToRename,
        renameDocumentError,
        onRenameDirectory,
        onCancelRenameDirectory,
        onClearRenameDirectoryError,
        directoryPathToRename,
        renameDirectoryError,
      }}
    >
      <div
        className="flex-1 overflow-hidden"
        style={{ scrollbarColor: 'inherit', scrollbarWidth: 'inherit' }}
        onKeyDownCapture={handleKeyDown}
      >
        <AutoSizer
          renderProp={({ width, height }) => (
            <Tree
              ref={treeRef}
              data={data}
              selection={selection ?? undefined}
              width={width ?? '100%'}
              height={height}
              rowHeight={32}
              className="explorer-tree overflow-auto"
              onActivate={handleActivate}
            >
              {TreeNode}
            </Tree>
          )}
        />
      </div>
    </TreeCallbacksContext.Provider>
  );
};
