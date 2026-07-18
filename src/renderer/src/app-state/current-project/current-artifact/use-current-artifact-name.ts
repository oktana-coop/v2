import { useMemo } from 'react';

import {
  removeExtension,
  removePath,
} from '../../../../../modules/infrastructure/filesystem';
import { useArtifactPath } from './artifact-path';
import { useCurrentArtifactId } from './use-current-artifact-id';

export const useCurrentArtifactName = () => {
  const currentArtifactId = useCurrentArtifactId();
  const { path } = useArtifactPath(currentArtifactId);

  return useMemo(
    () => (path ? removeExtension(removePath(path)) : null),
    [path]
  );
};
