import {
  isProjectDirectoryNode,
  type ProjectTreeNode,
} from '../../../../../../modules/domain/project';
import {
  filesystemEntryTypes,
  removePath,
} from '../../../../../../modules/infrastructure/filesystem';
import {
  type ExplorerTreeNode,
  NEW_DIRECTORY_NODE_ID,
  NEW_FILE_NODE_ID,
  type PendingTreeEntry,
} from './tree/types';

const toPendingNode = ({
  type,
  name = '',
}: PendingTreeEntry): ExplorerTreeNode =>
  type === filesystemEntryTypes.DIRECTORY
    ? {
        id: NEW_DIRECTORY_NODE_ID,
        name,
        type: filesystemEntryTypes.DIRECTORY,
        children: [],
        shared: false,
      }
    : {
        id: NEW_FILE_NODE_ID,
        name,
        type: filesystemEntryTypes.FILE,
        shared: false,
      };

export const injectPendingNode = (
  nodes: ExplorerTreeNode[],
  entry: PendingTreeEntry
): ExplorerTreeNode[] => {
  const pendingNode = toPendingNode(entry);

  const injectInto = (siblings: ExplorerTreeNode[]): ExplorerTreeNode[] =>
    siblings.map((node) => {
      if (
        node.type === filesystemEntryTypes.DIRECTORY &&
        node.id === entry.parentPath
      ) {
        return {
          ...node,
          children: [pendingNode, ...(node.children ?? [])],
        };
      }

      if (node.children) {
        return { ...node, children: injectInto(node.children) };
      }

      return node;
    });

  return entry.parentPath ? injectInto(nodes) : [pendingNode, ...nodes];
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
