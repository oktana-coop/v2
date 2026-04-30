import { useCallback, useContext } from 'react';

import { projectTypes } from '../../../modules/domain/project';
import {
  CommitModalContext,
  CurrentDocumentContext,
  CurrentProjectContext,
  MultiDocumentProjectContext,
  SingleDocumentProjectContext,
} from '../app-state';

export const useCommitToProject = () => {
  const { projectType } = useContext(CurrentProjectContext);
  const { commitChanges: multiDocumentCommitChanges } = useContext(
    MultiDocumentProjectContext
  );
  const { commitChanges: singleDocumentCommitChanges } = useContext(
    SingleDocumentProjectContext
  );
  const { closeCommitModal } = useContext(CommitModalContext);
  const { reloadDocumentHistory } = useContext(CurrentDocumentContext);

  const commit =
    projectType === projectTypes.MULTI_DOCUMENT_PROJECT
      ? multiDocumentCommitChanges
      : singleDocumentCommitChanges;

  return useCallback(
    async (message: string) => {
      await commit(message);
      closeCommitModal();
      // No-op when there is no active document.
      await reloadDocumentHistory();
    },
    [commit, closeCommitModal, reloadDocumentHistory]
  );
};
