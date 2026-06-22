import { useContext, useEffect, useState } from 'react';

import { MultiDocumentProjectContext } from '../app-state';

export const useCurrentDocumentName = () => {
  const { selectedFileName } = useContext(MultiDocumentProjectContext);

  const [documentName, setDocumentName] = useState<string | null>(null);

  useEffect(() => {
    setDocumentName(selectedFileName);
  }, [selectedFileName]);

  return documentName;
};
