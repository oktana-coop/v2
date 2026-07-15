import { useMemo } from 'react';

import { inferArtifactTypeFromExtension } from '../../../modules/domain/project';
import { versionedArtifactTypes } from '../../../modules/infrastructure/version-control';
import { useArtifactPath } from './use-artifact-path';
import { useCurrentArtifactId } from './use-current-artifact-id';

export const useCurrentDocumentId = () => {
  const artifactId = useCurrentArtifactId();
  const { path } = useArtifactPath(artifactId);

  return useMemo(() => {
    const isDocument =
      path != null &&
      inferArtifactTypeFromExtension(path) ===
        versionedArtifactTypes.RICH_TEXT_DOCUMENT;

    return isDocument ? artifactId : null;
  }, [artifactId, path]);
};
