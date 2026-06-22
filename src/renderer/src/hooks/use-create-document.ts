import { useContext, useEffect, useState } from 'react';

import { MultiDocumentProjectContext } from '../app-state';
import { useNavigateToArtifact } from './use-navigate-to-artifact';

export const useCreateDocument = () => {
  const [canCreateDocument, setCanCreateDocument] = useState<boolean>(false);
  const navigateToArtifact = useNavigateToArtifact();

  const { createNewDocument, directory } = useContext(
    MultiDocumentProjectContext
  );

  const triggerDocumentCreationDialog = async ({
    parentPath,
  }: { parentPath?: string } = {}) => {
    const { projectId, documentId, path } = await createNewDocument({
      parentPath,
    });
    navigateToArtifact({ projectId, artifactId: documentId, path });
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
