import { useContext, useEffect, useState } from 'react';

import { inferArtifactTypeFromExtension } from '../../../modules/domain/project';
import {
  type ArtifactId,
  versionedArtifactTypes,
} from '../../../modules/infrastructure/version-control';
import { ProjectContext } from '../app-state';

export const useCurrentDocumentId = () => {
  const { selectedFileInfo } = useContext(ProjectContext);

  const [id, setId] = useState<ArtifactId | null>(null);

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
