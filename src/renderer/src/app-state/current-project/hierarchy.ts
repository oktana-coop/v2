import * as Effect from 'effect/Effect';
import { useCallback, useEffect, useState } from 'react';

import {
  areProjectTreesEqual,
  type ProjectTreeNode,
} from '../../../../modules/domain/project';
import { type ProjectContextType } from './types';

type HierarchyDeps = Pick<
  ProjectContextType,
  | 'projectId'
  | 'projectStore'
  | 'directory'
  | 'currentBranch'
  | 'subscribeToProjectDirChanges'
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
  subscribeToProjectDirChanges,
}: HierarchyDeps): HierarchyOps => {
  const [directoryTree, setDirectoryTree] = useState<ProjectTreeNode[]>([]);

  // TODO: Consider guarding against overlapping reads landing out of order.
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

    // An unchanged tree keeps its identity, so echoes of the app's own
    // writes do not re-render the explorer.
    setDirectoryTree((current) =>
      areProjectTreesEqual(current, tree) ? current : tree
    );
  }, [projectStore, projectId, directory]);

  useEffect(() => {
    refreshDirectoryTree();
  }, [refreshDirectoryTree, currentBranch, pulledUpstreamChanges]);

  useEffect(
    () =>
      subscribeToProjectDirChanges(() => {
        refreshDirectoryTree();
      }),
    [subscribeToProjectDirChanges, refreshDirectoryTree]
  );

  return { directoryTree, refreshDirectoryTree };
};
