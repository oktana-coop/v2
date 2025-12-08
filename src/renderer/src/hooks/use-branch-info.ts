import { useCallback, useContext, useEffect, useState } from 'react';

import { projectTypes } from '../../../modules/domain/project';
import { type Branch } from '../../../modules/infrastructure/version-control';
import {
  CurrentProjectContext,
  MultiDocumentProjectContext,
  SingleDocumentProjectContext,
} from '../app-state';

export const useBranchInfo = () => {
  const { projectType } = useContext(CurrentProjectContext);
  const {
    currentBranch: multiDocumentProjectCurrentBranch,
    listBranches: listMultiDocumentProjectBranches,
    createAndSwitchToBranch: createAndSwitchToBranchInMultiDocumentProject,
    switchToBranch: switchToBranchInMultiDocumentProject,
    isCreateBranchDialogOpen: isCreateBranchDialogOpenInMultiDocumentProject,
    openCreateBranchDialog: openCreateBranchDialogInMultiDocumentProject,
    closeCreateBranchDialog: closeCreateBranchDialogInMultiDocumentProject,
    deleteBranch: deleteBranchInMultiDocumentProject,
    mergeAndDeleteBranch: mergeAndDeleteBranchInMultiDocumentProject,
    branchToDelete: branchToDeleteInMultiDocumentProject,
    openDeleteBranchDialog: openDeleteBranchDialogInMultiDocumentProject,
    closeDeleteBranchDialog: closeDeleteBranchDialogInMultiDocumentProject,
  } = useContext(MultiDocumentProjectContext);
  const {
    currentBranch: singleDocumentProjectCurrentBranch,
    listBranches: listSingleDocumentProjectBranches,
    createAndSwitchToBranch: createAndSwitchToBranchInSingleDocumentProject,
    switchToBranch: switchToBranchInSingleDocumentProject,
    isCreateBranchDialogOpen: isCreateBranchDialogOpenInSingleDocumentProject,
    openCreateBranchDialog: openCreateBranchDialogInSingleDocumentProject,
    closeCreateBranchDialog: closeCreateBranchDialogInSingleDocumentProject,
    deleteBranch: deleteBranchInSingleDocumentProject,
    mergeAndDeleteBranch: mergeAndDeleteBranchInSingleDocumentProject,
    branchToDelete: branchToDeleteInSingleDocumentProject,
    openDeleteBranchDialog: openDeleteBranchDialogInSingleDocumentProject,
    closeDeleteBranchDialog: closeDeleteBranchDialogInSingleDocumentProject,
  } = useContext(SingleDocumentProjectContext);

  const [currentBranch, setCurrentBranch] = useState<Branch | null>(null);
  const [isCreateBranchDialogOpen, setIsCreateBranchDialogOpen] =
    useState<boolean>(false);
  const [branchToDelete, setBranchToDelete] = useState<Branch | null>(null);

  useEffect(() => {
    const branch =
      projectType === projectTypes.MULTI_DOCUMENT_PROJECT
        ? multiDocumentProjectCurrentBranch
        : singleDocumentProjectCurrentBranch;
    setCurrentBranch(branch);
  }, [
    multiDocumentProjectCurrentBranch,
    singleDocumentProjectCurrentBranch,
    projectType,
  ]);

  useEffect(() => {
    const createDialogOpen =
      projectType === projectTypes.MULTI_DOCUMENT_PROJECT
        ? isCreateBranchDialogOpenInMultiDocumentProject
        : isCreateBranchDialogOpenInSingleDocumentProject;
    setIsCreateBranchDialogOpen(createDialogOpen);
  }, [
    isCreateBranchDialogOpenInMultiDocumentProject,
    isCreateBranchDialogOpenInSingleDocumentProject,
    projectType,
  ]);

  useEffect(() => {
    const branchToDel =
      projectType === projectTypes.MULTI_DOCUMENT_PROJECT
        ? branchToDeleteInMultiDocumentProject
        : branchToDeleteInSingleDocumentProject;
    setBranchToDelete(branchToDel);
  }, [
    branchToDeleteInMultiDocumentProject,
    branchToDeleteInSingleDocumentProject,
    projectType,
  ]);

  const listBranches = useCallback(
    () =>
      projectType === projectTypes.MULTI_DOCUMENT_PROJECT
        ? listMultiDocumentProjectBranches()
        : listSingleDocumentProjectBranches(),
    [
      projectType,
      listMultiDocumentProjectBranches,
      listSingleDocumentProjectBranches,
    ]
  );

  const createAndSwitchToBranch = useCallback(
    (branchName: string) =>
      projectType === projectTypes.MULTI_DOCUMENT_PROJECT
        ? createAndSwitchToBranchInMultiDocumentProject(branchName)
        : createAndSwitchToBranchInSingleDocumentProject(branchName),
    [
      projectType,
      createAndSwitchToBranchInMultiDocumentProject,
      createAndSwitchToBranchInSingleDocumentProject,
    ]
  );

  const switchToBranch = useCallback(
    (branch: Branch) =>
      projectType === projectTypes.MULTI_DOCUMENT_PROJECT
        ? switchToBranchInMultiDocumentProject(branch)
        : switchToBranchInSingleDocumentProject(branch),
    [
      projectType,
      switchToBranchInMultiDocumentProject,
      switchToBranchInSingleDocumentProject,
    ]
  );

  const openCreateBranchDialog = useCallback(
    () =>
      projectType === projectTypes.MULTI_DOCUMENT_PROJECT
        ? openCreateBranchDialogInMultiDocumentProject()
        : openCreateBranchDialogInSingleDocumentProject(),
    [
      projectType,
      openCreateBranchDialogInMultiDocumentProject,
      openCreateBranchDialogInSingleDocumentProject,
    ]
  );

  const closeCreateBranchDialog = useCallback(
    () =>
      projectType === projectTypes.MULTI_DOCUMENT_PROJECT
        ? closeCreateBranchDialogInMultiDocumentProject()
        : closeCreateBranchDialogInSingleDocumentProject(),
    [
      projectType,
      closeCreateBranchDialogInMultiDocumentProject,
      closeCreateBranchDialogInSingleDocumentProject,
    ]
  );

  const deleteBranch = useCallback(
    (branch: Branch) =>
      projectType === projectTypes.MULTI_DOCUMENT_PROJECT
        ? deleteBranchInMultiDocumentProject(branch)
        : deleteBranchInSingleDocumentProject(branch),
    [
      projectType,
      deleteBranchInMultiDocumentProject,
      deleteBranchInSingleDocumentProject,
    ]
  );

  const mergeAndDeleteBranch = useCallback(
    (branch: Branch) =>
      projectType === projectTypes.MULTI_DOCUMENT_PROJECT
        ? mergeAndDeleteBranchInMultiDocumentProject(branch)
        : mergeAndDeleteBranchInSingleDocumentProject(branch),
    [
      projectType,
      mergeAndDeleteBranchInMultiDocumentProject,
      mergeAndDeleteBranchInSingleDocumentProject,
    ]
  );

  const openDeleteBranchDialog = useCallback(
    (branch: Branch) =>
      projectType === projectTypes.MULTI_DOCUMENT_PROJECT
        ? openDeleteBranchDialogInMultiDocumentProject(branch)
        : openDeleteBranchDialogInSingleDocumentProject(branch),
    [
      projectType,
      openDeleteBranchDialogInMultiDocumentProject,
      openDeleteBranchDialogInSingleDocumentProject,
    ]
  );

  const closeDeleteBranchDialog = useCallback(
    () =>
      projectType === projectTypes.MULTI_DOCUMENT_PROJECT
        ? closeDeleteBranchDialogInMultiDocumentProject()
        : closeDeleteBranchDialogInSingleDocumentProject(),
    [
      projectType,
      closeDeleteBranchDialogInMultiDocumentProject,
      closeDeleteBranchDialogInSingleDocumentProject,
    ]
  );

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
  };
};
