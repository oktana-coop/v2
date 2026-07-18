import { useMemo } from 'react';

import { inferArtifactTypeFromExtension } from '../../../../../modules/domain/project';
import { type VersionedArtifactType } from '../../../../../modules/infrastructure/version-control';
import { useArtifactPath } from './artifact-path';
import { useCurrentArtifactId } from './use-current-artifact-id';

type UseArtifactTypeResult = {
  // Once resolved, null means the artifact couldn't be classified.
  artifactType: VersionedArtifactType | null;
  loading: boolean;
};

export const useArtifactType = (): UseArtifactTypeResult => {
  const artifactId = useCurrentArtifactId();
  const { path, loading } = useArtifactPath(artifactId);

  const artifactType = useMemo(
    () => (path === null ? null : inferArtifactTypeFromExtension(path)),
    [path]
  );

  return { artifactType, loading };
};
