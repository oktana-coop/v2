import { useContext, useEffect, useState } from 'react';

import { projectTypes } from '../../../modules/domain/project';
import { type ResolvedArtifactId } from '../../../modules/infrastructure/version-control';
import {
  CurrentProjectContext,
  MultiDocumentProjectContext,
  SingleDocumentProjectContext,
} from '../app-state';

export const useCurrentDocumentId = () => {
  const { projectType } = useContext(CurrentProjectContext);
  const { selectedFileInfo } = useContext(MultiDocumentProjectContext);
  // Project and document are 1:1 in single document projects
  const { documentId } = useContext(SingleDocumentProjectContext);

  const [id, setId] = useState<ResolvedArtifactId | null>(null);

  useEffect(() => {
    const docId =
      projectType === projectTypes.MULTI_DOCUMENT_PROJECT
        ? (selectedFileInfo?.documentId ?? null)
        : documentId;
    setId(docId);
  }, [documentId, selectedFileInfo, projectType]);

  return id;
};
