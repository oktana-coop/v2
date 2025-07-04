import { useContext, useEffect, useState } from 'react';
import { useParams } from 'react-router';

import { projectTypes } from '../../../modules/domain/project';
import { removeExtension } from '../../../modules/infrastructure/filesystem';
import {
  CurrentProjectContext,
  MultiDocumentProjectContext,
  MultiDocumentProjectContextType,
  RecentProjectsContext,
  RecentProjectsContextType,
} from '../app-state';

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
  documentIdParam: string | undefined
): DocumentListItem[] =>
  recentProjects.map((projectInfo) => {
    const documentListItem: DocumentListItem = {
      id: projectInfo.documentId,
      name: projectInfo.projectName ?? 'Untitled Document',
      isSelected: documentIdParam === projectInfo.documentId,
    };

    return documentListItem;
  });

export const useDocumentList = () => {
  const { documentId: documentIdParam } = useParams();
  const { projectType } = useContext(CurrentProjectContext);
  const { directory, directoryFiles, selectedFileInfo } = useContext(
    MultiDocumentProjectContext
  );
  const { recentProjects } = useContext(RecentProjectsContext);
  const [documentList, setDocumentList] = useState<DocumentListItem[]>([]);
  const [canShowList, setCanShowList] = useState<boolean>(false);

  useEffect(() => {
    const newList =
      projectType === projectTypes.MULTI_DOCUMENT_PROJECT
        ? getDocumentListInMultiDocumentProject(
            directoryFiles,
            selectedFileInfo
          )
        : getDocumentListInSingleDocumentProject(
            recentProjects,
            documentIdParam
          );

    setDocumentList(newList);
  }, [
    projectType,
    recentProjects,
    documentIdParam,
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
