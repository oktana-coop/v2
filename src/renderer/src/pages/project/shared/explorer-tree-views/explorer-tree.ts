import {
  isProjectDirectoryNode,
  type ProjectTreeNode,
} from '../../../../../../modules/domain/project';
import {
  filesystemEntryTypes,
  removePath,
} from '../../../../../../modules/infrastructure/filesystem';
import { type ExplorerTreeNode, NEW_DIRECTORY_NODE_ID } from './tree/types';

export const injectPendingDirectoryNode = (
  nodes: ExplorerTreeNode[],
  parentPath?: string
): ExplorerTreeNode[] => {
  const pendingDirectoryNode: ExplorerTreeNode = {
    id: NEW_DIRECTORY_NODE_ID,
    name: '',
    type: filesystemEntryTypes.DIRECTORY,
    children: [],
    shared: false,
  };

  if (!parentPath) return [pendingDirectoryNode, ...nodes];

  return nodes.map((node) => {
    if (
      node.type === filesystemEntryTypes.DIRECTORY &&
      node.id === parentPath
    ) {
      return {
        ...node,
        children: [pendingDirectoryNode, ...(node.children ?? [])],
      };
    }

    if (node.children) {
      return {
        ...node,
        children: injectPendingDirectoryNode(node.children, parentPath),
      };
    }

    return node;
  });
};

export const getExplorerTreeInProject = (
  directoryTree: ProjectTreeNode[]
): ExplorerTreeNode[] => {
  const toExplorerNode = (node: ProjectTreeNode): ExplorerTreeNode =>
    isProjectDirectoryNode(node)
      ? {
          id: node.path,
          name: removePath(node.path),
          type: filesystemEntryTypes.DIRECTORY,
          children: node.children.map(toExplorerNode),
          shared: false,
        }
      : {
          id: node.path,
          name: removePath(node.path),
          type: filesystemEntryTypes.FILE,
          shared: node.shared,
        };

  return directoryTree.map(toExplorerNode);
};
