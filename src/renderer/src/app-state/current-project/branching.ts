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
  VersionControlBranchSwitchConflictErrorTag,
  VersionControlMergeConflictErrorTag,
} from '../../../../modules/infrastructure/version-control';
import { useNavigateToResolveConflicts } from './resolve-conflicts-navigation';
import {
  type BranchSwitchRefusal,
  type ProjectContextType,
  type ProjectStateSetters,
} from './types';

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
    async (branch: Branch): Promise<BranchSwitchRefusal | null> => {
      if (!projectStore || !projectId) {
        throw new Error(
          'Project store is not ready or project has not been set yet. Cannot switch branch.'
        );
      }

      const refusal = await Effect.runPromise(
        pipe(
          projectStore.switchToBranch({ projectId, branch }),
          Effect.map((): BranchSwitchRefusal | null => null),
          Effect.catchTag(VersionControlBranchSwitchConflictErrorTag, (error) =>
            Effect.succeed<BranchSwitchRefusal>({
              filepaths: error.data.filepaths,
            })
          ),
          Effect.tapError((error) =>
            Effect.sync(() => {
              console.error(error);
              dispatchNotification(
                createErrorNotification({
                  title: 'Switch Branch Error',
                  message: `Could not switch to "${branch}".`,
                })
              );
            })
          )
        )
      );

      if (refusal) {
        dispatchNotification(
          createErrorNotification({
            title: 'Switch Branch Error',
            message: `Your local changes to ${refusal.filepaths.join(', ')} would be overwritten by switching to "${branch}". Commit or discard them first.`,
          })
        );
        return refusal;
      }

      setCurrentBranch(branch);
      return null;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectStore, projectId, dispatchNotification]
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
