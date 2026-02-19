import { useContext, useEffect, useState } from 'react';

import { type ProjectId, projectTypes } from '../../../modules/domain/project';
import {
  CurrentProjectContext,
  MultiDocumentProjectContext,
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
  const { directory, selectedFileInfo } = useContext(
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
        ? []
        : getDocumentListInSingleDocumentProject(
            recentProjects,
            singleDocumentProjectId
          );

    setDocumentList(newList);
  }, [documentId, projectType, recentProjects, selectedFileInfo]);

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
