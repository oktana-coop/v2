import { useContext } from 'react';

import { SingleDocumentProjectContext } from '../../app-state';
import { useNavigateToDocument } from '../use-navigate-to-document';
import { useNavigateToResolveConflicts } from '../use-navigate-to-resolve-merge-conflicts';

export const useOpenDocument = () => {
  const navigateToDocument = useNavigateToDocument();
  const navigateToResolveMergeConflicts = useNavigateToResolveConflicts();

  const { openDocument } = useContext(SingleDocumentProjectContext);

  return async () => {
    const { projectId, documentId, path, mergeConflictInfo } =
      await openDocument();

    if (projectId && documentId) {
      if (!mergeConflictInfo) {
        navigateToDocument({ projectId, documentId, path });
      } else {
        navigateToResolveMergeConflicts({ projectId, mergeConflictInfo });
      }
    }
  };
};
