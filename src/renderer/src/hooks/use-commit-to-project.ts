import { useCallback, useContext } from 'react';

import {
  CommitModalContext,
  CurrentDocumentContext,
  MultiDocumentProjectContext,
} from '../app-state';

export const useCommitToProject = () => {
  const { commitChanges: commit } = useContext(MultiDocumentProjectContext);
  const { closeCommitModal } = useContext(CommitModalContext);
  const { reloadDocumentHistory } = useContext(CurrentDocumentContext);

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
