import * as Effect from 'effect/Effect';
import { useCallback, useEffect, useState } from 'react';

import {
  areProjectTreesEqual,
  getProjectTree,
  type ProjectTreeNode,
  type RegisteredShare,
  type ShareRegistry,
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
  shareRegistry: ShareRegistry;
  // The registry's content; a change re-reads the tree.
  shares: RegisteredShare[];
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
  shareRegistry,
  shares,
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
      getProjectTree({
        getProjectStoreTree: projectStore.getProjectTree,
        isShared: shareRegistry.isShared,
      })({
        projectId,
        branch: currentBranch,
      })
    );

    // An unchanged tree keeps its identity, so echoes of the app's own
    // writes do not re-render the explorer.
    setDirectoryTree((current) =>
      areProjectTreesEqual(current, tree) ? current : tree
    );
  }, [projectStore, projectId, directory, currentBranch, shareRegistry]);

  useEffect(() => {
    refreshDirectoryTree();
  }, [refreshDirectoryTree, pulledUpstreamChanges, shares]);

  useEffect(
    () =>
      subscribeToProjectDirChanges(() => {
        refreshDirectoryTree();
      }),
    [subscribeToProjectDirChanges, refreshDirectoryTree]
  );

  return { directoryTree, refreshDirectoryTree };
};
