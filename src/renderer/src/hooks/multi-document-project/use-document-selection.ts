import { useContext } from 'react';
import { useNavigate } from 'react-router';

import {
  CurrentDocumentContext,
  MultiDocumentProjectContext,
} from '../../../../modules/app-state';

export const useDocumentSelection = () => {
  const navigate = useNavigate();
  const { projectId, findDocumentInProject } = useContext(
    MultiDocumentProjectContext
  );
  const { setSelectedFileInfo } = useContext(CurrentDocumentContext);

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

    await setSelectedFileInfo({
      documentId: documentHandle.url,
      path: documentPath,
    });
    navigate(
      `/documents/${documentHandle.url}?path=${encodeURIComponent(documentPath)}`
    );
  };
};
