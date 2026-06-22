import { useContext, useEffect, useState } from 'react';

import { ProjectContext } from '../app-state';

export const useCurrentDocumentName = () => {
  const { selectedFileName } = useContext(ProjectContext);

  const [documentName, setDocumentName] = useState<string | null>(null);

  useEffect(() => {
    setDocumentName(selectedFileName);
  }, [selectedFileName]);

  return documentName;
};
