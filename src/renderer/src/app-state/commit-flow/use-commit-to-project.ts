import { useCallback, useContext } from 'react';

import { CurrentDocumentContext } from '../current-document/context';
import { ProjectContext } from '../current-project/context';
import { CommitModalContext } from './commit-modal/context';

export const useCommitToProject = () => {
  const { commitChanges: commit } = useContext(ProjectContext);
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
