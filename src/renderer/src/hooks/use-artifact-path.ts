import * as Effect from 'effect/Effect';
import { useContext, useEffect, useState } from 'react';

import {
  type ProjectId,
  type ProjectRelPath,
  type ProjectStore,
} from '../../../modules/domain/project';
import { type ArtifactId } from '../../../modules/infrastructure/version-control';
import { ProjectContext } from '../app-state';

export type UseArtifactPathResult = {
  path: ProjectRelPath | null;
  loading: boolean;
};

export const useResolveArtifactPath = ({
  projectId,
  projectStore,
  artifactId,
}: {
  projectId: ProjectId | null;
  projectStore: ProjectStore | null;
  artifactId: ArtifactId | null;
}): UseArtifactPathResult => {
  const [path, setPath] = useState<ProjectRelPath | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!artifactId) {
      setPath(null);
      setLoading(false);
      return;
    }

    // The project store isn't ready yet; stay loading so consumers don't read
    // this as a resolved "no path".
    if (!projectId || !projectStore) {
      setPath(null);
      setLoading(true);
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

// Context-bound convenience over useResolveArtifactPath for renderer consumers
// that read the current project from context.
export const useArtifactPath = (
  artifactId: ArtifactId | null
): UseArtifactPathResult => {
  const { projectId, projectStore } = useContext(ProjectContext);

  return useResolveArtifactPath({ projectId, projectStore, artifactId });
};
