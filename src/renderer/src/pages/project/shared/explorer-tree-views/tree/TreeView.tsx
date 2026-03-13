import { createContext, useContext } from 'react';
import { type NodeApi, Tree } from 'react-arborist';
import { AutoSizer } from 'react-virtualized-auto-sizer';

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
  onRenameDocument = async () => {},
  onCancelRenameDocument = () => {},
  onClearRenameDocumentError = () => {},
  filePathToRename = null,
  renameDocumentError = null,
  onRenameDirectory = async () => {},
  onCancelRenameDirectory = () => {},
  onClearRenameDirectoryError = () => {},
  directoryPathToRename = null,
  renameDirectoryError = null,
}: {
  data: ExplorerTreeNode[];
  selection: string | null;
  onSelectItem: (id: string) => Promise<void>;
  onCreateDirectory?: (name: string) => Promise<void>;
  onCancelCreateDirectory?: () => void;
  onRenameDocument?: (oldPath: string, newName: string) => Promise<void>;
  onCancelRenameDocument?: () => void;
  onClearRenameDocumentError?: () => void;
  filePathToRename?: string | null;
  renameDocumentError?: string | null;
  onRenameDirectory?: (oldPath: string, newName: string) => Promise<void>;
  onCancelRenameDirectory?: () => void;
  onClearRenameDirectoryError?: () => void;
  directoryPathToRename?: string | null;
  renameDirectoryError?: string | null;
}) => {
  const handleActivate = (node: NodeApi<ExplorerTreeNode>) => {
    if (
      node.data.type === filesystemItemTypes.FILE ||
      node.data.type === STRUCTURAL_CONFLICTS_NODE_TYPE
    ) {
      onSelectItem(node.id);
    }
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
      >
        <AutoSizer
          renderProp={({ width, height }) => (
            <Tree
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
