import * as Effect from 'effect/Effect';
import { useContext } from 'react';

import { ProjectContext } from '../context';
import { useNavigateToArtifact } from './use-navigate-to-artifact';

export const useArtifactSelection = () => {
  const { projectId, projectStore } = useContext(ProjectContext);
  const navigateToArtifact = useNavigateToArtifact();

  return async (path: string) => {
    if (!projectId || !projectStore) {
      // TODO: Handle more gracefully
      throw new Error('Could not select file because no project was found');
    }

    const artifactId = await Effect.runPromise(
      projectStore.lookupArtifactInProject({ projectId, path })
    );

    navigateToArtifact({ projectId, artifactId });
  };
};
