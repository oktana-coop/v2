import { useContext, useState } from 'react';

import { projectTypes } from '../../../../../modules/domain/project';
import { ElectronContext } from '../../../../../modules/infrastructure/cross-platform/electron-context';
import { SidebarLayout } from '../../../components/layout/SidebarLayout';
import { StackedResizablePanelsLayout } from '../../../components/layout/StackedResizablePanelsLayout';
import { useCreateDocument, useNavigateToDocument } from '../../../hooks';
import { useOpenDirectory } from '../../../hooks/multi-document-project';
import { useOpenDocument } from '../../../hooks/single-document-project';
import { CreateDocumentModal } from '../create-document/CreateDocumentModal';
import {
  DirectoryFiles,
  RecentProjects,
} from '../current-project/document/sidebar/document-list-views';
import { EmptyMainView } from '../empty-main-view';

export const ProjectSelection = () => {
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
    <SidebarLayout
      sidebar={
        <StackedResizablePanelsLayout autoSaveId="project-selection-panel-group">
          {window.config.projectType === projectTypes.MULTI_DOCUMENT_PROJECT ? (
            <DirectoryFiles onCreateDocument={handleCreateDocument} />
          ) : (
            <RecentProjects onCreateDocument={handleCreateDocument} />
          )}
        </StackedResizablePanelsLayout>
      }
    >
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
    </SidebarLayout>
  );
};
