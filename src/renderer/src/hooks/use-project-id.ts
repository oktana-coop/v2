import { useContext } from 'react';

import { projectTypes } from '../../../modules/domain/project';
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

  return projectType === projectTypes.MULTI_DOCUMENT_PROJECT
    ? multiDocumentProjectId
    : singleDocumentProjectId;
};
