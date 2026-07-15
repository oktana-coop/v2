import { useContext, useEffect, useState } from 'react';

import { ProjectContext } from '../app-state';
import { useNavigateToArtifact } from './use-navigate-to-artifact';

export const useCreateDocument = () => {
  const [canCreateDocument, setCanCreateDocument] = useState<boolean>(false);
  const navigateToArtifact = useNavigateToArtifact();

  const { createNewDocument, directory } = useContext(ProjectContext);

  const triggerDocumentCreationDialog = async ({
    parentPath,
  }: { parentPath?: string } = {}) => {
    const result = await createNewDocument({ parentPath });

    if (!result) return;

    const { projectId, documentId } = result;
    navigateToArtifact({ projectId, artifactId: documentId });
  };

  useEffect(() => {
    setCanCreateDocument(
      Boolean(directory && directory.permissionState === 'granted')
    );
  }, [directory]);

  return {
    canCreateDocument,
    createNewDocument,
    triggerDocumentCreationDialog,
  };
};
