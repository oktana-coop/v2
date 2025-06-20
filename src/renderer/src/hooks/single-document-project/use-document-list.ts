import { useContext } from 'react';
import { useParams } from 'react-router';

import { RecentProjectsContext } from '../../../../modules/app-state';
import { type DocumentListItem } from '../types';

export const useDocumentList = () => {
  const { documentId: documentIdParam } = useParams();
  const { recentProjects } = useContext(RecentProjectsContext);

  return () =>
    recentProjects.map((projectInfo) => {
      const documentListItem: DocumentListItem = {
        id: projectInfo.documentId,
        name: projectInfo.projectName ?? 'Untitled Document',
        isSelected: documentIdParam === projectInfo.documentId,
      };

      return documentListItem;
    });
};
