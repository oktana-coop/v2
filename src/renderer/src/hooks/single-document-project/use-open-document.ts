import { useContext } from 'react';
import { useNavigate } from 'react-router';

import {
  CurrentDocumentContext,
  SingleDocumentProjectContext,
} from '../../../../modules/app-state';

export const useOpenDocument = () => {
  const navigate = useNavigate();
  const { openDocument } = useContext(SingleDocumentProjectContext);
  const { setSelectedFileInfo } = useContext(CurrentDocumentContext);

  return async () => {
    const { documentId, path } = await openDocument();

    await setSelectedFileInfo({
      documentId,
      path,
    });
    navigate(`/documents/${documentId}?path=${encodeURIComponent(path)}`);
  };
};
