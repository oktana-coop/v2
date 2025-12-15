import { useContext, useState } from 'react';

import { ElectronContext } from '../../../../../modules/infrastructure/cross-platform/electron-context';
import { useCreateDocument, useNavigateToDocument } from '../../../hooks';
import { useOpenDirectory } from '../../../hooks/multi-document-project';
import { useOpenDocument } from '../../../hooks/single-document-project';
import { CreateDocumentModal } from '../create-document/CreateDocumentModal';
import { EmptyMainView } from '../empty-main-view';

export const DocumentSelection = () => {
  const { isElectron } = useContext(ElectronContext);
  const { createNewDocument } = useCreateDocument();
  const openDocument = useOpenDocument();
  const openDirectory = useOpenDirectory();
  const [isDocumentCreationModalOpen, setCreateDocumentModalOpen] =
    useState<boolean>(false);

  const navigateToDocument = useNavigateToDocument();

  const handleCreateDocument = async () => {
    if (!isElectron) {
      openCreateDocumentModal();
    } else {
      const { projectId, documentId, path } = await createNewDocument();
      navigateToDocument({ projectId, documentId, path });
    }
  };

  const handleOpenDocument = () => openDocument();

  const handleOpenDirectory = () => openDirectory();

  const openCreateDocumentModal = () => {
    setCreateDocumentModalOpen(true);
  };

  const closeCreateDocumentModal = () => {
    setCreateDocumentModalOpen(false);
  };

  return (
    <>
      <EmptyMainView
        onCreateDocumentButtonClick={handleCreateDocument}
        onOpenDocumentButtonClick={handleOpenDocument}
        onOpenDirectoryButtonClick={handleOpenDirectory}
      />
      <CreateDocumentModal
        isOpen={isDocumentCreationModalOpen}
        onClose={closeCreateDocumentModal}
        onCreateDocument={navigateToDocument}
      />
    </>
  );
};
