import * as Effect from 'effect/Effect';
import { useCallback, useEffect, useState } from 'react';

import { type ProjectTreeNode } from '../../../../modules/domain/project';
import { type ProjectContextType } from './types';

type HierarchyDeps = Pick<
  ProjectContextType,
  'projectId' | 'projectStore' | 'directory' | 'currentBranch'
> & {
  pulledUpstreamChanges: boolean;
};

type HierarchyOps = Pick<
  ProjectContextType,
  'directoryTree' | 'refreshDirectoryTree'
>;

export const useHierarchyOps = ({
  projectId,
  projectStore,
  directory,
  currentBranch,
  pulledUpstreamChanges,
}: HierarchyDeps): HierarchyOps => {
  const [directoryTree, setDirectoryTree] = useState<ProjectTreeNode[]>([]);

  const refreshDirectoryTree = useCallback(async () => {
    if (
      !projectStore ||
      !projectId ||
      !directory ||
      directory.permissionState !== 'granted'
    ) {
      return;
    }

    const tree = await Effect.runPromise(
      projectStore.getProjectTree(projectId)
    );
    setDirectoryTree(tree);
  }, [projectStore, projectId, directory]);

  useEffect(() => {
    refreshDirectoryTree();
  }, [refreshDirectoryTree, currentBranch, pulledUpstreamChanges]);

  return { directoryTree, refreshDirectoryTree };
};
