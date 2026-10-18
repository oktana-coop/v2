import { useCallback, useContext } from 'react';

import { ProjectContext } from '../current-project/context';
import { CurrentArtifactVersioningContext } from '../current-project/current-artifact/versioning';
import { CommitModalContext } from './commit-modal/context';

export const useCommitToProject = () => {
  const { commitChanges: commit } = useContext(ProjectContext);
  const { closeCommitModal } = useContext(CommitModalContext);
  const { reloadDocumentHistory } = useContext(
    CurrentArtifactVersioningContext
  );

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
