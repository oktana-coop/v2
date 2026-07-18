import { useMemo } from 'react';

import { versionedArtifactTypes } from '../../../../modules/infrastructure/version-control';
import { useArtifactType } from '../current-project/current-artifact/use-artifact-type';
import { useCurrentArtifactId } from '../current-project/current-artifact/use-current-artifact-id';

// The current artifact's id, or null when the open artifact isn't a document.
export const useCurrentDocumentId = () => {
  const artifactId = useCurrentArtifactId();
  const { artifactType } = useArtifactType();

  return useMemo(
    () =>
      artifactType === versionedArtifactTypes.RICH_TEXT_DOCUMENT
        ? artifactId
        : null,
    [artifactId, artifactType]
  );
};
