import { useContext } from 'react';

import { MultiDocumentProjectContext } from '../../app-state';
import { useNavigateToDocument } from '../use-navigate-to-document';

export const useDocumentSelection = () => {
  const { projectId, findDocumentInProject } = useContext(
    MultiDocumentProjectContext
  );
  const navigateToDocument = useNavigateToDocument();

  return async (documentPath: string) => {
    if (!projectId) {
      // TODO: Handle more gracefully
      throw new Error('Could not select file because no project ID was found');
    }

    const documentHandle = await findDocumentInProject({
      projectId,
      documentPath,
    });

    if (!documentHandle) {
      // TODO: Handle more gracefully
      throw new Error(
        'Could not select file because the versioned document was not found in project'
      );
    }

    navigateToDocument({
      documentId: documentHandle.url,
      path: documentPath,
    });
  };
};
