import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import { useCallback, useContext, useEffect, useState } from 'react';

import {
  createErrorNotification,
  NotificationsContext,
} from '../../../../modules/infrastructure/notifications/browser';
import {
  type Branch,
  DEFAULT_BRANCH,
  parseBranch,
  VersionControlMergeConflictErrorTag,
} from '../../../../modules/infrastructure/version-control';
import { type ProjectContextType, type ProjectStateSetters } from './types';
import { useNavigateToResolveConflicts } from './use-navigate-to-resolve-conflicts';

type BranchingDeps = Pick<ProjectContextType, 'projectId' | 'projectStore'> &
  Pick<ProjectStateSetters, 'setCurrentBranch' | 'setMergeConflictInfo'>;

type BranchingOps = Pick<
  ProjectContextType,
  | 'listBranches'
  | 'createAndSwitchToBranch'
  | 'switchToBranch'
  | 'deleteBranch'
  | 'mergeAndDeleteBranch'
  | 'isCreateBranchDialogOpen'
  | 'openCreateBranchDialog'
  | 'closeCreateBranchDialog'
  | 'branchToDelete'
  | 'openDeleteBranchDialog'
  | 'closeDeleteBranchDialog'
  | 'supportsBranching'
>;

export const useBranchingOps = ({
  projectId,
  projectStore,
  setCurrentBranch,
  setMergeConflictInfo,
}: BranchingDeps): BranchingOps => {
  const { dispatchNotification } = useContext(NotificationsContext);
  const navigateToResolveMergeConflicts = useNavigateToResolveConflicts();

  const [isCreateBranchDialogOpen, setIsCreateBranchDialogOpen] =
    useState<boolean>(false);
  const [branchToDelete, setBranchToDelete] = useState<Branch | null>(null);
  const [supportsBranching, setSupportsBranching] = useState<boolean>(false);

  useEffect(() => {
    if (projectStore) {
      setSupportsBranching(projectStore.supportsBranching);
    }
  }, [projectStore]);

  const handleListBranches = useCallback(async () => {
    if (!projectStore || !projectId) {
      throw new Error(
        'Project store is not ready or project has not been set yet. Cannot list branches'
      );
    }

    const branches = await Effect.runPromise(
      projectStore.listBranches({ projectId })
    );

    return branches;
  }, [projectStore, projectId]);

  const handleCreateAndSwitchToBranch = useCallback(
    async (branchName: string) => {
      if (!projectStore || !projectId) {
        throw new Error(
          'Project store is not ready or project has not been set yet. Cannot create branch.'
        );
      }

      let branch: Branch;
      try {
        branch = parseBranch(branchName);
      } catch (err) {
        console.error(err);
        throw new Error('Invalid branch name');
      }

      await Effect.runPromise(
        projectStore.createAndSwitchToBranch({ projectId, branch })
      );

      setCurrentBranch(branch);
      setIsCreateBranchDialogOpen(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectStore, projectId]
  );

  const handleSwitchToBranch = useCallback(
    async (branch: Branch) => {
      if (!projectStore || !projectId) {
        throw new Error(
          'Project store is not ready or project has not been set yet. Cannot create branch.'
        );
      }

      await Effect.runPromise(
        projectStore.switchToBranch({ projectId, branch })
      );

      setCurrentBranch(branch);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectStore, projectId]
  );

  const handleOpenCreateBranchDialog = useCallback(() => {
    setIsCreateBranchDialogOpen(true);
  }, []);

  const handleCloseCreateBranchDialog = useCallback(() => {
    setIsCreateBranchDialogOpen(false);
  }, []);

  const handleDeleteBranch = useCallback(
    async (branch: Branch) => {
      if (!projectStore || !projectId) {
        throw new Error(
          'Project store is not ready or project has not been set yet. Cannot delete branch.'
        );
      }

      const { currentBranch: resultingCurrentBranch } = await Effect.runPromise(
        projectStore.deleteBranch({ projectId, branch })
      );

      setBranchToDelete(null);
      setCurrentBranch(resultingCurrentBranch);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectStore, projectId]
  );

  const handleMergeAndDeleteBranch = useCallback(
    async (branch: Branch) => {
      if (!projectStore || !projectId) {
        throw new Error(
          'Project store is not ready or project has not been set yet. Cannot delete branch.'
        );
      }

      const { notification, mergeConflictInfo: conflictInfo } =
        await Effect.runPromise(
          pipe(
            pipe(
              projectStore.mergeAndDeleteBranch({
                projectId,
                from: branch,
                into: DEFAULT_BRANCH as Branch,
              }),
              Effect.map((lastCommitId) => ({
                result: lastCommitId,
                notification: null,
                mergeConflictInfo: null,
              }))
            ),
            Effect.catchTag(VersionControlMergeConflictErrorTag, (err) =>
              Effect.succeed({
                result: null,
                notification: null,
                mergeConflictInfo: err.data,
              })
            ),
            Effect.catchAll((err) => {
              console.error(err);
              const notification = createErrorNotification({
                title: 'Merge Error',
                message: `An error happened when trying to merge "${branch}" into "${DEFAULT_BRANCH}" branch`,
              });

              return Effect.succeed({
                result: null,
                notification,
                mergeConflictInfo: null,
              });
            })
          )
        );

      if (notification) {
        dispatchNotification(notification);
      }

      setCurrentBranch(DEFAULT_BRANCH as Branch);

      if (conflictInfo) {
        setMergeConflictInfo(conflictInfo);
        navigateToResolveMergeConflicts({
          projectId,
          mergeConflictInfo: conflictInfo,
        });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectStore, projectId, navigateToResolveMergeConflicts]
  );

  const handleOpenDeleteBranchDialog = useCallback((branch: Branch) => {
    setBranchToDelete(branch);
  }, []);

  const handleCloseDeleteBranchDialog = useCallback(() => {
    setBranchToDelete(null);
  }, []);

  return {
    listBranches: handleListBranches,
    createAndSwitchToBranch: handleCreateAndSwitchToBranch,
    switchToBranch: handleSwitchToBranch,
    deleteBranch: handleDeleteBranch,
    mergeAndDeleteBranch: handleMergeAndDeleteBranch,
    isCreateBranchDialogOpen,
    openCreateBranchDialog: handleOpenCreateBranchDialog,
    closeCreateBranchDialog: handleCloseCreateBranchDialog,
    branchToDelete,
    openDeleteBranchDialog: handleOpenDeleteBranchDialog,
    closeDeleteBranchDialog: handleCloseDeleteBranchDialog,
    supportsBranching,
  };
};
