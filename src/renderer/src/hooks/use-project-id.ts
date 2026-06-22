import { useContext } from 'react';

import { MultiDocumentProjectContext } from '../app-state';

export const useProjectId = () => {
  const { projectId } = useContext(MultiDocumentProjectContext);
  return projectId;
};
