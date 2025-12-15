import { useContext, useEffect, useState } from 'react';

import { ProjectId, projectTypes } from '../../../modules/domain/project';
import {
  CurrentProjectContext,
  MultiDocumentProjectContext,
  SingleDocumentProjectContext,
} from '../app-state';

export const useProjectId = () => {
  const { projectType } = useContext(CurrentProjectContext);
  const { projectId: multiDocumentProjectId } = useContext(
    MultiDocumentProjectContext
  );
  const { projectId: singleDocumentProjectId } = useContext(
    SingleDocumentProjectContext
  );

  const [projectId, setProjectId] = useState<ProjectId | null>(null);

  useEffect(() => {
    const id =
      projectType === projectTypes.MULTI_DOCUMENT_PROJECT
        ? multiDocumentProjectId
        : singleDocumentProjectId;
    setProjectId(id);
  }, [multiDocumentProjectId, singleDocumentProjectId, projectType]);

  return projectId;
};
