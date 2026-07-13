import * as Effect from 'effect/Effect';
import { useContext, useEffect, useState } from 'react';
import { useParams } from 'react-router';

import { inferArtifactTypeFromExtension } from '../../../modules/domain/project';
import {
  decodeUrlEncodedArtifactId,
  type VersionedArtifactType,
} from '../../../modules/infrastructure/version-control';
import { ProjectContext } from '../app-state';

type UseArtifactTypeResult = {
  // Once resolved, null means the artifact couldn't be classified.
  artifactType: VersionedArtifactType | null;
  loading: boolean;
};

// Derives the type of the artifact currently in the route, along with a loading
// flag for the async store lookup. Ids are opaque here: we ask the store for the
// artifact's project path and classify by that, rather than parsing the id.
export const useArtifactType = (): UseArtifactTypeResult => {
  const { artifactId: urlEncodedArtifactId } = useParams();
  const { projectId, projectStore } = useContext(ProjectContext);
  const [artifactType, setArtifactType] =
    useState<VersionedArtifactType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const artifactId = urlEncodedArtifactId
      ? decodeUrlEncodedArtifactId(urlEncodedArtifactId)
      : null;

    if (!artifactId || !projectId || !projectStore) {
      setArtifactType(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    Effect.runPromise(
      projectStore.getArtifactPathById({ projectId, artifactId })
    )
      .then((path) => {
        if (cancelled) return;
        setArtifactType(inferArtifactTypeFromExtension(path));
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setArtifactType(null);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [urlEncodedArtifactId, projectId, projectStore]);

  return { artifactType, loading };
};
