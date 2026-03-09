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
};

const TreeCallbacksContext = createContext<TreeCallbacks>({
  onCreateDirectory: async () => {},
  onCancelCreateDirectory: () => {},
});

export const useTreeCallbacks = () => useContext(TreeCallbacksContext);

export const TreeView = ({
  data,
  selection,
  onSelectItem,
  onCreateDirectory = async () => {},
  onCancelCreateDirectory = () => {},
}: {
  data: ExplorerTreeNode[];
  selection: string | null;
  onSelectItem: (id: string) => Promise<void>;
  onCreateDirectory?: (name: string) => Promise<void>;
  onCancelCreateDirectory?: () => void;
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
      value={{ onCreateDirectory, onCancelCreateDirectory }}
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
