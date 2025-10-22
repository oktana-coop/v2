import { useContext, useEffect, useState } from 'react';

import { projectTypes } from '../../../modules/domain/project';
import { removeExtension } from '../../../modules/infrastructure/filesystem';
import { VersionControlId } from '../../../modules/infrastructure/version-control';
import {
  CurrentProjectContext,
  MultiDocumentProjectContext,
  MultiDocumentProjectContextType,
  RecentProjectsContext,
  RecentProjectsContextType,
} from '../app-state';
import { useCurrentDocumentId } from './use-current-document-id';

export type DocumentListItem = {
  id: string;
  name: string;
  isSelected: boolean;
};

const getDocumentListInMultiDocumentProject = (
  directoryFiles: MultiDocumentProjectContextType['directoryFiles'],
  selectedFileInfo: MultiDocumentProjectContextType['selectedFileInfo']
): DocumentListItem[] =>
  directoryFiles.map((file) => {
    const documentListItem: DocumentListItem = {
      id: file.path,
      name: removeExtension(file.name),
      isSelected: selectedFileInfo?.path === file.path,
    };

    return documentListItem;
  });

const getDocumentListInSingleDocumentProject = (
  recentProjects: RecentProjectsContextType['recentProjects'],
  documentId: VersionControlId | null
): DocumentListItem[] =>
  recentProjects.map((projectInfo) => {
    const documentListItem: DocumentListItem = {
      id: projectInfo.documentId,
      name: projectInfo.projectName ?? 'Untitled Document',
      isSelected: documentId === projectInfo.documentId,
    };

    return documentListItem;
  });

export const useDocumentList = () => {
  const { projectType } = useContext(CurrentProjectContext);
  const { directory, directoryFiles, selectedFileInfo } = useContext(
    MultiDocumentProjectContext
  );
  const { recentProjects } = useContext(RecentProjectsContext);
  const [documentList, setDocumentList] = useState<DocumentListItem[]>([]);
  const [canShowList, setCanShowList] = useState<boolean>(false);
  const documentId = useCurrentDocumentId();

  useEffect(() => {
    const newList =
      projectType === projectTypes.MULTI_DOCUMENT_PROJECT
        ? getDocumentListInMultiDocumentProject(
            directoryFiles,
            selectedFileInfo
          )
        : getDocumentListInSingleDocumentProject(recentProjects, documentId);

    setDocumentList(newList);
  }, [
    documentId,
    projectType,
    recentProjects,
    directoryFiles,
    selectedFileInfo,
  ]);

  useEffect(() => {
    const canShowDocumentList =
      projectType === projectTypes.MULTI_DOCUMENT_PROJECT
        ? Boolean(directory && directory.permissionState === 'granted')
        : true;

    setCanShowList(canShowDocumentList);
  }, [projectType, directory]);

  return {
    canShowList,
    documentList,
  };
};
