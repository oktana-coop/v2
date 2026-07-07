import { useContext, useEffect, useState } from 'react';

import { isUnsupportedExtension } from '../../../modules/domain/rich-text';
import {
  type Directory,
  type File,
  type FilesystemItemType,
  filesystemItemTypes,
  isDirectory,
} from '../../../modules/infrastructure/filesystem';
import { ProjectContext, ProjectContextType } from '../app-state';
import { useCurrentDocumentId } from './use-current-document-id';

export const STRUCTURAL_CONFLICTS_NODE_TYPE = 'STRUCTURAL_CONFLICTS' as const;
export const NEW_DIRECTORY_NODE_ID = 'NEW_DIRECTORY' as const;

export type ExplorerTreeNode = {
  id: string;
  name: string;
  type: FilesystemItemType | typeof STRUCTURAL_CONFLICTS_NODE_TYPE;
  children?: ExplorerTreeNode[];
};

export type DocumentListItem = {
  id: string;
  name: string;
  isSelected: boolean;
};

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
  const mapFileToTreeNode = (file: File): ExplorerTreeNode => ({
    id: file.path,
    name: file.name,
    type: filesystemItemTypes.FILE,
  });

  const getDirectorySubtree = (directory: Directory): ExplorerTreeNode => {
    const subtreeNode: ExplorerTreeNode = {
      id: directory.path,
      name: directory.name,
      type: filesystemItemTypes.DIRECTORY,
      children: directory.children?.map((child) => {
        if (isDirectory(child)) {
          return getDirectorySubtree(child);
        }

        return mapFileToTreeNode(child);
      }),
    };

    return subtreeNode;
  };

  const rootNodes = directoryTree.map((item) => {
    if (isDirectory(item)) {
      return getDirectorySubtree(item);
    }

    return mapFileToTreeNode(item);
  });

  return rootNodes;
};

// Filter function taking an explorer tree and returning only the files that the
// editor can open, descending into subdirectories and dropping directories and
// assets with unsupported extensions.
//
// TODO: Move this to the project domain models (e.g.
// src/modules/domain/project/models/project-documents.ts) operating on
// Array<Directory | File>, and have consumers depend on it directly rather than
// via this hook module.
export const getOpenableDocuments = (
  nodes: ExplorerTreeNode[]
): ExplorerTreeNode[] =>
  nodes.flatMap((node) => {
    if (node.type === filesystemItemTypes.DIRECTORY) {
      return node.children ? getOpenableDocuments(node.children) : [];
    }

    if (
      node.type === filesystemItemTypes.FILE &&
      !isUnsupportedExtension(node.name)
    ) {
      return [node];
    }

    return [];
  });

export const useDocumentExplorerTree = () => {
  const {
    directory,
    directoryTree,
    selectedFileInfo,
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
  const documentId = useCurrentDocumentId();

  useEffect(() => {
    let newTree = getExplorerTreeInProject(directoryTree);

    if (pendingNewDirectory) {
      newTree = injectPendingDirectoryNode(
        newTree,
        pendingNewDirectory.parentPath
      );
    }

    setExplorerTree(newTree);
    setSelection(selectedFileInfo?.path ?? null);
  }, [documentId, directoryTree, selectedFileInfo, pendingNewDirectory]);

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
