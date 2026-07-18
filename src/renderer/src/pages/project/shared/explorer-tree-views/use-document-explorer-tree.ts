import { useContext, useEffect, useState } from 'react';

import { type ArtifactTreeNode } from '../../../../../../modules/domain/project';
import { filesystemItemTypes } from '../../../../../../modules/infrastructure/filesystem';
import {
  ProjectContext,
  ProjectContextType,
  useArtifactPath,
  useCurrentArtifactId,
} from '../../../../app-state';
import { type ExplorerTreeNode, NEW_DIRECTORY_NODE_ID } from './tree/types';

const injectPendingDirectoryNode = (
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

const getExplorerTreeInProject = (
  directoryTree: ProjectContextType['directoryTree']
): ExplorerTreeNode[] => {
  const toExplorerNode = (node: ArtifactTreeNode): ExplorerTreeNode =>
    node.type === filesystemItemTypes.DIRECTORY
      ? {
          id: node.path,
          name: node.name,
          type: filesystemItemTypes.DIRECTORY,
          children: node.children?.map(toExplorerNode),
        }
      : {
          id: node.path,
          name: node.name,
          type: filesystemItemTypes.FILE,
        };

  return directoryTree.map(toExplorerNode);
};

export const useDocumentExplorerTree = () => {
  const {
    directory,
    directoryTree,
    pendingNewDirectory,
    startCreateDirectory,
    createDirectory,
    cancelCreateDirectory,
    filePathToRename,
    startRenameDocument,
    renameDocumentError,
    clearRenameDocumentError,
    renameDocument,
    cancelRenameDocument,
    directoryPathToRename,
    startRenameDirectory,
    renameDirectoryError,
    clearRenameDirectoryError,
    renameDirectory,
    cancelRenameDirectory,
    startDeleteDocument,
    startDeleteDirectory,
  } = useContext(ProjectContext);
  const [explorerTree, setExplorerTree] = useState<ExplorerTreeNode[]>([]);
  const [hasPendingNewDirectory, setHasPendingNewDirectory] = useState(false);
  const [canShowTree, setCanShowTree] = useState<boolean>(false);
  const [selection, setSelection] = useState<string | null>(null);
  const currentArtifactId = useCurrentArtifactId();
  const { path: currentArtifactPath } = useArtifactPath(currentArtifactId);

  useEffect(() => {
    let newTree = getExplorerTreeInProject(directoryTree);

    if (pendingNewDirectory) {
      newTree = injectPendingDirectoryNode(
        newTree,
        pendingNewDirectory.parentPath
      );
    }

    setExplorerTree(newTree);
    setSelection(currentArtifactPath ?? null);
  }, [directoryTree, currentArtifactPath, pendingNewDirectory]);

  useEffect(() => {
    setHasPendingNewDirectory(pendingNewDirectory !== null);
  }, [pendingNewDirectory]);

  useEffect(() => {
    setCanShowTree(
      Boolean(directory && directory.permissionState === 'granted')
    );
  }, [directory]);

  return {
    canShowTree,
    explorerTree,
    selection,
    hasPendingNewDirectory,
    startCreateDirectory,
    createDirectory,
    cancelCreateDirectory,
    filePathToRename,
    startRenameDocument,
    renameDocumentError,
    clearRenameDocumentError,
    renameDocument,
    cancelRenameDocument,
    directoryPathToRename,
    startRenameDirectory,
    renameDirectoryError,
    clearRenameDirectoryError,
    renameDirectory,
    cancelRenameDirectory,
    startDeleteDocument,
    startDeleteDirectory,
  };
};
