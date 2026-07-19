import {
  type ArtifactTreeNode,
  getArtifactNameWithExtension,
} from '../../../../../../modules/domain/project';
import { filesystemItemTypes } from '../../../../../../modules/infrastructure/filesystem';
import { type ExplorerTreeNode, NEW_DIRECTORY_NODE_ID } from './tree/types';

export const injectPendingDirectoryNode = (
  nodes: ExplorerTreeNode[],
  parentPath?: string
): ExplorerTreeNode[] => {
  const pendingDirectoryNode: ExplorerTreeNode = {
    id: NEW_DIRECTORY_NODE_ID,
    name: '',
    type: filesystemItemTypes.DIRECTORY,
    children: [],
  };

  if (!parentPath) return [pendingDirectoryNode, ...nodes];

  return nodes.map((node) => {
    if (node.type === filesystemItemTypes.DIRECTORY && node.id === parentPath) {
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
  directoryTree: ArtifactTreeNode[]
): ExplorerTreeNode[] => {
  const toExplorerNode = (node: ArtifactTreeNode): ExplorerTreeNode =>
    node.filesystemType === filesystemItemTypes.DIRECTORY
      ? {
          id: node.path,
          name: getArtifactNameWithExtension(node.path),
          type: filesystemItemTypes.DIRECTORY,
          children: node.children?.map(toExplorerNode),
        }
      : {
          id: node.path,
          name: getArtifactNameWithExtension(node.path),
          type: filesystemItemTypes.FILE,
        };

  return directoryTree.map(toExplorerNode);
};
