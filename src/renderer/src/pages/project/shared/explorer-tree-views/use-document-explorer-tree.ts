import { useContext, useEffect, useState } from 'react';

import {
  ProjectContext,
  useArtifactPath,
  useCurrentArtifactId,
} from '../../../../app-state';
import {
  getExplorerTreeInProject,
  injectPendingDirectoryNode,
} from './explorer-tree';
import { type ExplorerTreeNode } from './tree/types';

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
