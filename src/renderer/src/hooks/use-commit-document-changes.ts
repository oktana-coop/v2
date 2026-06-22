import { useCallback, useContext } from 'react';

import {
  CommitModalContext,
  CurrentDocumentContext,
  MultiDocumentProjectContext,
} from '../app-state';

export const useCommitDocumentChanges = () => {
  const { versionedDocumentId } = useContext(CurrentDocumentContext);
  const { commitDocumentChanges } = useContext(MultiDocumentProjectContext);
  const { closeCommitModal } = useContext(CommitModalContext);
  const { reloadDocumentHistory } = useContext(CurrentDocumentContext);

  return useCallback(
    async (message: string) => {
      if (!versionedDocumentId) return;
      await commitDocumentChanges({
        documentId: versionedDocumentId,
        message,
      });
      closeCommitModal();
      await reloadDocumentHistory();
    },
    [
      versionedDocumentId,
      commitDocumentChanges,
      closeCommitModal,
      reloadDocumentHistory,
    ]
  );
};
