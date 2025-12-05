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
  } = useContext(MultiDocumentProjectContext);
  const {
    currentBranch: singleDocumentProjectCurrentBranch,
    listBranches: listSingleDocumentProjectBranches,
  } = useContext(SingleDocumentProjectContext);

  const [currentBranch, setCurrentBranch] = useState<Branch | null>(null);

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

  const listBranches = useCallback(
    () =>
      projectType === projectTypes.MULTI_DOCUMENT_PROJECT
        ? listMultiDocumentProjectBranches()
        : listSingleDocumentProjectBranches(),
    [projectType]
  );

  return { currentBranch, listBranches };
};
