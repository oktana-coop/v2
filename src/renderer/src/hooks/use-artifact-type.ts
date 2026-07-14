import { useMemo } from 'react';
import { useParams } from 'react-router';

import { inferArtifactTypeFromExtension } from '../../../modules/domain/project';
import {
  decodeUrlEncodedArtifactId,
  type VersionedArtifactType,
} from '../../../modules/infrastructure/version-control';
import { useArtifactPath } from './use-artifact-path';

type UseArtifactTypeResult = {
  // Once resolved, null means the artifact couldn't be classified.
  artifactType: VersionedArtifactType | null;
  loading: boolean;
};

export const useArtifactType = (): UseArtifactTypeResult => {
  const { artifactId: urlEncodedArtifactId } = useParams();
  const artifactId = useMemo(
    () =>
      urlEncodedArtifactId
        ? decodeUrlEncodedArtifactId(urlEncodedArtifactId)
        : null,
    [urlEncodedArtifactId]
  );

  const { path, loading } = useArtifactPath(artifactId);

  const artifactType = useMemo(
    () => (path === null ? null : inferArtifactTypeFromExtension(path)),
    [path]
  );

  return { artifactType, loading };
};
