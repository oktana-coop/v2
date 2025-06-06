import { useContext } from 'react';
import { useNavigate } from 'react-router';

import {
  CurrentDocumentContext,
  CurrentProjectContext,
  MultiDocumentProjectContext,
} from '../../../../modules/app-state';
import { type File } from '../../../../modules/infrastructure/filesystem';

export const useFileSelection = () => {
  const navigate = useNavigate();
  const { projectId } = useContext(CurrentProjectContext);
  const { findDocumentInProject } = useContext(MultiDocumentProjectContext);
  const { setSelectedFileInfo } = useContext(CurrentDocumentContext);

  return async (file: File) => {
    if (!projectId) {
      // TODO: Handle more gracefully
      throw new Error('Could not select file because no project ID was found');
    }

    const documentHandle = await findDocumentInProject({
      projectId,
      documentPath: file.path!,
    });

    if (!documentHandle) {
      // TODO: Handle more gracefully
      throw new Error(
        'Could not select file because the versioned document was not found in project'
      );
    }

    if (!file.path) {
      // TODO: Handle more gracefully
      throw new Error('Could not select file because the file path is missing');
    }

    await setSelectedFileInfo({
      documentId: documentHandle.url,
      path: file.path,
    });
    navigate(
      `/documents/${documentHandle.url}?path=${encodeURIComponent(file.path)}`
    );
  };
};
