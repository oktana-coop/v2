import { useContext, useEffect, useState } from 'react';

import {
  inferArtifactTypeFromExtension,
  projectTypes,
} from '../../../modules/domain/project';
import {
  type ResolvedArtifactId,
  versionedArtifactTypes,
} from '../../../modules/infrastructure/version-control';
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
    if (projectType !== projectTypes.MULTI_DOCUMENT_PROJECT) {
      setId(documentId);
      return;
    }

    const path = selectedFileInfo?.path;
    const isDocument =
      path != null &&
      inferArtifactTypeFromExtension(path) ===
        versionedArtifactTypes.RICH_TEXT_DOCUMENT;

    setId(isDocument ? (selectedFileInfo?.documentId ?? null) : null);
  }, [documentId, selectedFileInfo, projectType]);

  return id;
};
