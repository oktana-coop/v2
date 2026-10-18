import * as Effect from 'effect/Effect';
import { useCallback } from 'react';

import { type ProjectContextType } from './types';

type CommittingDeps = Pick<ProjectContextType, 'projectId' | 'projectStore'>;

type CommittingOps = Pick<ProjectContextType, 'commitChanges'>;

export const useCommittingOps = ({
  projectId,
  projectStore,
}: CommittingDeps): CommittingOps => {
  const commitChanges = useCallback(
    async (message: string) => {
      if (!projectStore || !projectId) {
        throw new Error(
          'Project store is not ready or project has not been set yet. Cannot commit changes.'
        );
      }
      await Effect.runPromise(
        projectStore.commitChanges({ projectId, message })
      );
    },
    [projectStore, projectId]
  );

  return { commitChanges };
};
