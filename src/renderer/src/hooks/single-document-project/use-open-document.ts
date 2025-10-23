import { useContext } from 'react';

import { SingleDocumentProjectContext } from '../../app-state';
import { useNavigateToDocument } from '../use-navigate-to-document';

export const useOpenDocument = () => {
  const navigateToDocument = useNavigateToDocument();
  const { openDocument } = useContext(SingleDocumentProjectContext);

  return async () => {
    const { projectId, documentId, path } = await openDocument();

    if (projectId && documentId) {
      navigateToDocument({ projectId, documentId, path });
    }
  };
};
