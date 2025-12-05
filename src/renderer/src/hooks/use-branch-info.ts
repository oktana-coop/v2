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
  } = useContext(MultiDocumentProjectContext);
  const {
    currentBranch: singleDocumentProjectCurrentBranch,
    listBranches: listSingleDocumentProjectBranches,
    createAndSwitchToBranch: createAndSwitchToBranchInSingleDocumentProject,
    switchToBranch: switchToBranchInSingleDocumentProject,
    isCreateBranchDialogOpen: isCreateBranchDialogOpenInSingleDocumentProject,
    openCreateBranchDialog: openCreateBranchDialogInSingleDocumentProject,
    closeCreateBranchDialog: closeCreateBranchDialogInSingleDocumentProject,
  } = useContext(SingleDocumentProjectContext);

  const [currentBranch, setCurrentBranch] = useState<Branch | null>(null);
  const [isCreateBranchDialogOpen, setIsCreateBranchDialogOpen] =
    useState<boolean>(false);

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

  const listBranches = useCallback(
    () =>
      projectType === projectTypes.MULTI_DOCUMENT_PROJECT
        ? listMultiDocumentProjectBranches()
        : listSingleDocumentProjectBranches(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectType]
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

  return {
    currentBranch,
    listBranches,
    createAndSwitchToBranch,
    switchToBranch,
    isCreateBranchDialogOpen,
    openCreateBranchDialog,
    closeCreateBranchDialog,
  };
};
