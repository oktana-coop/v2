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

// Flattens the explorer tree into the list of file nodes the editor can
// actually open as documents, descending into directories so documents in
// subfolders are reachable too. Directories and assets with unsupported
// extensions (which would otherwise open the unsupported-document view) are
// dropped. Used to populate the command palette's document list.
//
// The command palette caps how many of these it renders at once (see
// MAX_VISIBLE_DOCUMENTS), so a large project's full document set does not have
// to be rendered even though every document remains reachable via search.
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
