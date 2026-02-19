import { useContext, useEffect, useState } from 'react';

import { projectTypes } from '../../../modules/domain/project';
import {
  type Directory,
  type File,
  type FilesystemItemType,
  filesystemItemTypes,
  isDirectory,
} from '../../../modules/infrastructure/filesystem';
import {
  CurrentProjectContext,
  MultiDocumentProjectContext,
  MultiDocumentProjectContextType,
  RecentProjectsContext,
  RecentProjectsContextType,
  SingleDocumentProjectContext,
} from '../app-state';
import { useCurrentDocumentId } from './use-current-document-id';

export type ExplorerTreeNode = {
  id: string;
  name: string;
  type: FilesystemItemType;
  children?: ExplorerTreeNode[];
};

export type DocumentListItem = {
  id: string;
  name: string;
  isSelected: boolean;
};

const getExplorerTreeInMultiDocumentProject = (
  directoryTree: MultiDocumentProjectContextType['directoryTree']
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

const getExplorerTreeInSingleDocumentProject = (
  recentProjects: RecentProjectsContextType['recentProjects']
): ExplorerTreeNode[] =>
  recentProjects.map((projectInfo) => {
    const explorerTreeNode: ExplorerTreeNode = {
      id: projectInfo.projectId,
      name: projectInfo.projectName ?? 'Untitled Document',
      type: filesystemItemTypes.FILE,
    };

    return explorerTreeNode;
  });

export const useDocumentExplorerTree = () => {
  const { projectType } = useContext(CurrentProjectContext);
  const { directory, directoryTree, selectedFileInfo } = useContext(
    MultiDocumentProjectContext
  );
  const { projectId: singleDocumentProjectId } = useContext(
    SingleDocumentProjectContext
  );
  const { recentProjects } = useContext(RecentProjectsContext);
  const [explorerTree, setExplorerTree] = useState<ExplorerTreeNode[]>([]);
  const [canShowTree, setCanShowTree] = useState<boolean>(false);
  const [selection, setSelection] = useState<string | null>(null);
  const documentId = useCurrentDocumentId();

  useEffect(() => {
    const newTree =
      projectType === projectTypes.MULTI_DOCUMENT_PROJECT
        ? getExplorerTreeInMultiDocumentProject(directoryTree)
        : getExplorerTreeInSingleDocumentProject(recentProjects);

    const selection =
      projectType === projectTypes.MULTI_DOCUMENT_PROJECT
        ? (selectedFileInfo?.path ?? null)
        : singleDocumentProjectId;

    setExplorerTree(newTree);
    setSelection(selection);
  }, [
    documentId,
    projectType,
    recentProjects,
    directoryTree,
    selectedFileInfo,
  ]);

  useEffect(() => {
    const canShowDocumentList =
      projectType === projectTypes.MULTI_DOCUMENT_PROJECT
        ? Boolean(directory && directory.permissionState === 'granted')
        : true;

    setCanShowTree(canShowDocumentList);
  }, [projectType, directory]);

  return {
    canShowTree,
    explorerTree,
    selection,
  };
};
