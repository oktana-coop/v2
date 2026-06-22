import { useContext } from 'react';

import { MultiDocumentProjectContext } from '../app-state';
import { useRemoteProjectInfo } from './use-remote-project-info';

export const useBranchInfo = () => {
  const {
    currentBranch,
    listBranches,
    createAndSwitchToBranch,
    switchToBranch,
    isCreateBranchDialogOpen,
    openCreateBranchDialog,
    closeCreateBranchDialog,
    deleteBranch,
    mergeAndDeleteBranch,
    branchToDelete,
    openDeleteBranchDialog,
    closeDeleteBranchDialog,
    supportsBranching,
    pushToRemoteProject,
    pullFromRemoteProject,
  } = useContext(MultiDocumentProjectContext);
  const { remoteProject } = useRemoteProjectInfo();

  return {
    currentBranch,
    listBranches,
    createAndSwitchToBranch,
    switchToBranch,
    isCreateBranchDialogOpen,
    openCreateBranchDialog,
    closeCreateBranchDialog,
    deleteBranch,
    mergeAndDeleteBranch,
    branchToDelete,
    openDeleteBranchDialog,
    closeDeleteBranchDialog,
    supportsBranching,
    supportsSync: Boolean(remoteProject),
    pushToRemoteProject,
    pullFromRemoteProject,
  };
};
