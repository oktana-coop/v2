import * as Effect from 'effect/Effect';
import { useContext, useEffect, useState } from 'react';
import { useParams } from 'react-router';

import { inferArtifactTypeFromExtension } from '../../../modules/domain/project';
import {
  decodeUrlEncodedArtifactId,
  type VersionedArtifactType,
} from '../../../modules/infrastructure/version-control';
import { ProjectContext } from '../app-state';

// Derives the type of the artifact currently in the route. `undefined` while
// still resolving, `null` when it resolved but couldn't be classified. Ids are
// opaque here: we ask the store for the artifact's project path and classify by
// that, rather than parsing the id.
export const useArtifactType = (): VersionedArtifactType | null | undefined => {
  const { artifactId: urlEncodedArtifactId } = useParams();
  const { projectId, projectStore } = useContext(ProjectContext);
  const [type, setType] = useState<VersionedArtifactType | null | undefined>(
    undefined
  );

  useEffect(() => {
    const artifactId = urlEncodedArtifactId
      ? decodeUrlEncodedArtifactId(urlEncodedArtifactId)
      : null;

    if (!artifactId || !projectId || !projectStore) {
      setType(null);
      return;
    }

    let cancelled = false;
    setType(undefined);

    Effect.runPromise(
      projectStore.getArtifactPathById({ projectId, artifactId })
    )
      .then((path) => {
        if (!cancelled) setType(inferArtifactTypeFromExtension(path));
      })
      .catch(() => {
        if (!cancelled) setType(null);
      });

    return () => {
      cancelled = true;
    };
  }, [urlEncodedArtifactId, projectId, projectStore]);

  return type;
};
