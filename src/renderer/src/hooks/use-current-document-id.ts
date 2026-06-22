import { useContext, useEffect, useState } from 'react';

import { inferArtifactTypeFromExtension } from '../../../modules/domain/project';
import {
  type ResolvedArtifactId,
  versionedArtifactTypes,
} from '../../../modules/infrastructure/version-control';
import { MultiDocumentProjectContext } from '../app-state';

export const useCurrentDocumentId = () => {
  const { selectedFileInfo } = useContext(MultiDocumentProjectContext);

  const [id, setId] = useState<ResolvedArtifactId | null>(null);

  useEffect(() => {
    const path = selectedFileInfo?.path;
    const isDocument =
      path != null &&
      inferArtifactTypeFromExtension(path) ===
        versionedArtifactTypes.RICH_TEXT_DOCUMENT;

    setId(isDocument ? (selectedFileInfo?.documentId ?? null) : null);
  }, [selectedFileInfo]);

  return id;
};
