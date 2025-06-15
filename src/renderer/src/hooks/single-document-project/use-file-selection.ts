import { useContext } from 'react';
import { useNavigate } from 'react-router';

import {
  CurrentDocumentContext,
  SingleDocumentProjectContext,
} from '../../../../modules/app-state';
import { type File } from '../../../../modules/infrastructure/filesystem';

export const useFileSelection = () => {
  const navigate = useNavigate();
  const { openDocument } = useContext(SingleDocumentProjectContext);
  const { setSelectedFileInfo } = useContext(CurrentDocumentContext);

  // TODO: Implement this
  return async (file: File) => {
    const { documentId, path } = await openDocument(file);

    await setSelectedFileInfo({
      documentId,
      path,
    });
    navigate(`/documents/${documentId}?path=${encodeURIComponent(path)}`);
  };
};
