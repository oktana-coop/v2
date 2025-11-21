import { useContext, useEffect, useState } from 'react';

import { type ProjectId, projectTypes } from '../../../modules/domain/project';
import { removeExtension } from '../../../modules/infrastructure/filesystem';
import {
  CurrentProjectContext,
  MultiDocumentProjectContext,
  MultiDocumentProjectContextType,
  RecentProjectsContext,
  RecentProjectsContextType,
  SingleDocumentProjectContext,
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
  projectId: ProjectId | null
): DocumentListItem[] =>
  recentProjects.map((projectInfo) => {
    const documentListItem: DocumentListItem = {
      id: projectInfo.projectId,
      name: projectInfo.projectName ?? 'Untitled Document',
      isSelected: projectId === projectInfo.projectId,
    };

    return documentListItem;
  });

export const useDocumentList = () => {
  const { projectType } = useContext(CurrentProjectContext);
  const { directory, directoryFiles, selectedFileInfo } = useContext(
    MultiDocumentProjectContext
  );
  const { projectId: singleDocumentProjectId } = useContext(
    SingleDocumentProjectContext
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
        : getDocumentListInSingleDocumentProject(
            recentProjects,
            singleDocumentProjectId
          );

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
