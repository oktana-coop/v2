import { useContext, useEffect, useState } from 'react';

import { projectTypes } from '../../../modules/domain/project';
import {
  CurrentProjectContext,
  MultiDocumentProjectContext,
  SingleDocumentProjectContext,
} from '../app-state';

export const useCurrentDocumentName = () => {
  const { projectType } = useContext(CurrentProjectContext);
  const { selectedFileName } = useContext(MultiDocumentProjectContext);
  // Project and document are 1:1 in single document projects, we use the project name as the document name
  const { projectName } = useContext(SingleDocumentProjectContext);

  const [documentName, setDocumentName] = useState<string | null>(null);

  useEffect(() => {
    const newName =
      projectType === projectTypes.MULTI_DOCUMENT_PROJECT
        ? selectedFileName
        : projectName;
    setDocumentName(newName);
  }, [projectName, selectedFileName, projectType]);

  return documentName;
};
