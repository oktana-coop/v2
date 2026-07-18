import { useMemo } from 'react';
import { useParams } from 'react-router';

import {
  type ArtifactId,
  decodeUrlEncodedArtifactId,
} from '../../../../../modules/infrastructure/version-control';

// The opaque id of the artifact currently in the route (`:artifactId`), or null.
// This is the single source of truth for "what artifact is selected".
export const useCurrentArtifactId = (): ArtifactId | null => {
  const { artifactId: urlEncodedArtifactId } = useParams();

  return useMemo(
    () =>
      urlEncodedArtifactId
        ? decodeUrlEncodedArtifactId(urlEncodedArtifactId)
        : null,
    [urlEncodedArtifactId]
  );
};
