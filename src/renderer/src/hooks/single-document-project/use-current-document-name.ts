import { useContext } from 'react';

import { SingleDocumentProjectContext } from '../../../../modules/app-state';

export const useCurrentDocumentName = () => {
  // Project and document are 1:1 in single document projects, we use the project name as the document name
  const { projectName } = useContext(SingleDocumentProjectContext);

  return () => {
    return projectName;
  };
};
