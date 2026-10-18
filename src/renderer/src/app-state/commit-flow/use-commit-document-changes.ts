import { useCallback, useContext } from 'react';

import { CurrentArtifactVersioningContext } from '../current-project/current-artifact/versioning';
import { CommitModalContext } from './commit-modal/context';

export const useCommitDocumentChanges = () => {
  const { onCommitDocumentChanges } = useContext(
    CurrentArtifactVersioningContext
  );
  const { closeCommitModal } = useContext(CommitModalContext);

  return useCallback(
    async (message: string) => {
      const committed = await onCommitDocumentChanges(message);
      if (committed) closeCommitModal();
    },
    [onCommitDocumentChanges, closeCommitModal]
  );
};
