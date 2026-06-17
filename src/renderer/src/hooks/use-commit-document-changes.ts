import { useCallback, useContext } from 'react';

import { projectTypes } from '../../../modules/domain/project';
import {
  CommitModalContext,
  CurrentDocumentContext,
  CurrentProjectContext,
  MultiDocumentProjectContext,
  SingleDocumentProjectContext,
} from '../app-state';

export const useCommitDocumentChanges = () => {
  const { projectType } = useContext(CurrentProjectContext);
  const { versionedDocumentId } = useContext(CurrentDocumentContext);
  const { commitDocumentChanges } = useContext(MultiDocumentProjectContext);
  const { commitChanges: commitChangesToSingleDocProject } = useContext(
    SingleDocumentProjectContext
  );
  const { closeCommitModal } = useContext(CommitModalContext);
  const { reloadDocumentHistory } = useContext(CurrentDocumentContext);

  return useCallback(
    async (message: string) => {
      if (projectType === projectTypes.MULTI_DOCUMENT_PROJECT) {
        if (!versionedDocumentId) return;
        await commitDocumentChanges({
          documentId: versionedDocumentId,
          message,
        });
      } else {
        await commitChangesToSingleDocProject(message);
      }
      closeCommitModal();
      await reloadDocumentHistory();
    },
    [
      projectType,
      versionedDocumentId,
      commitDocumentChanges,
      commitChangesToSingleDocProject,
      closeCommitModal,
      reloadDocumentHistory,
    ]
  );
};
