import * as Effect from 'effect/Effect';
import { useContext, useEffect, useState } from 'react';

import { type ProjectRelPath } from '../../../modules/domain/project';
import { type ArtifactId } from '../../../modules/infrastructure/version-control';
import { ProjectContext } from '../app-state';

type UseArtifactPathResult = {
  path: ProjectRelPath | null;
  loading: boolean;
};

export const useArtifactPath = (
  artifactId: ArtifactId | null
): UseArtifactPathResult => {
  const { projectId, projectStore } = useContext(ProjectContext);
  const [path, setPath] = useState<ProjectRelPath | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!artifactId || !projectId || !projectStore) {
      setPath(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    Effect.runPromise(
      projectStore.getArtifactPathById({ projectId, artifactId })
    )
      .then((resolvedPath) => {
        if (cancelled) return;
        setPath(resolvedPath);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setPath(null);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [artifactId, projectId, projectStore]);

  return { path, loading };
};
