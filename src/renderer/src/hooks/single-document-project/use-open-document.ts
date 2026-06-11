import { useContext } from 'react';

import { SingleDocumentProjectContext } from '../../app-state';
import { useNavigateToArtifact } from '../use-navigate-to-artifact';
import { useNavigateToResolveConflicts } from '../use-navigate-to-resolve-merge-conflicts';

export const useOpenDocument = () => {
  const navigateToArtifact = useNavigateToArtifact();
  const navigateToResolveMergeConflicts = useNavigateToResolveConflicts();

  const { openDocument } = useContext(SingleDocumentProjectContext);

  return async () => {
    const { projectId, documentId, path, mergeConflictInfo } =
      await openDocument();

    if (projectId && documentId) {
      if (!mergeConflictInfo) {
        navigateToArtifact({ projectId, artifactId: documentId, path });
      } else {
        navigateToResolveMergeConflicts({ projectId, mergeConflictInfo });
      }
    }
  };
};
