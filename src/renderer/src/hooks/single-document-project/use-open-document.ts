import { useContext } from 'react';
import { useNavigate } from 'react-router';

import { SingleDocumentProjectContext } from '../../app-state';

export const useOpenDocument = () => {
  const navigate = useNavigate();
  const { openDocument } = useContext(SingleDocumentProjectContext);

  return async () => {
    const { documentId } = await openDocument();
    navigate(`/documents/${documentId}`);
  };
};
