import { useContext, useEffect, useState } from 'react';

import { filesystemEntryTypes } from '../../../../../../modules/infrastructure/filesystem';
import { ProjectContext } from '../../../../app-state';
import { getExplorerTreeInProject, injectPendingNode } from './explorer-tree';
import { type ExplorerTreeNode } from './tree/types';

export const useDocumentExplorerTree = () => {
  const {
    directory,
    directoryTree,
    pendingNewDocument,
    createDocument,
    cancelCreateDocument,
    createDocumentError,
    clearCreateDocumentError,
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
    currentArtifact,
  } = useContext(ProjectContext);
  const [explorerTree, setExplorerTree] = useState<ExplorerTreeNode[]>([]);
  const [hasPendingNewDocument, setHasPendingNewDocument] = useState(false);
  const [hasPendingNewDirectory, setHasPendingNewDirectory] = useState(false);
  const [canShowTree, setCanShowTree] = useState<boolean>(false);
  const [selection, setSelection] = useState<string | null>(null);
  const currentArtifactPath = currentArtifact?.path ?? null;

  useEffect(() => {
    let newTree = getExplorerTreeInProject(directoryTree);

    if (pendingNewDirectory) {
      newTree = injectPendingNode(newTree, {
        type: filesystemEntryTypes.DIRECTORY,
        parentPath: pendingNewDirectory.parentPath,
      });
    }

    if (pendingNewDocument) {
      newTree = injectPendingNode(newTree, {
        type: filesystemEntryTypes.FILE,
        parentPath: pendingNewDocument.parentPath,
        name: pendingNewDocument.defaultName,
      });
    }

    setExplorerTree(newTree);
    setSelection(currentArtifactPath ?? null);
  }, [
    directoryTree,
    currentArtifactPath,
    pendingNewDirectory,
    pendingNewDocument,
  ]);

  useEffect(() => {
    setHasPendingNewDocument(pendingNewDocument !== null);
  }, [pendingNewDocument]);

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
    hasPendingNewDocument,
    createDocument,
    cancelCreateDocument,
    createDocumentError,
    clearCreateDocumentError,
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
