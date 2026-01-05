import { useContext } from 'react';

import { projectTypes } from '../../../../../../modules/domain/project';
import {
  CloneFromGithubModalContext,
  CreateDocumentModalContext,
} from '../../../../app-state';
import { SidebarLayout } from '../../../../components/layout/SidebarLayout';
import { StackedResizablePanelsLayout } from '../../../../components/layout/StackedResizablePanelsLayout';
import { useCreateDocument, useNavigateToDocument } from '../../../../hooks';
import { useOpenDirectory } from '../../../../hooks/multi-document-project';
import { useOpenDocument } from '../../../../hooks/single-document-project';
import { CloneFromGithubDialog } from '../../../shared/sync-providers/github/CloneFromGithubDialog';
import { CreateDocumentModal } from '../../shared/create-document/CreateDocumentModal';
import {
  DirectoryFiles,
  RecentProjects,
} from '../../shared/document-list-views';
import { EmptyMainView } from '../empty-main-view';

export const ProjectSelection = () => {
  const { triggerDocumentCreationDialog } = useCreateDocument();
  const openDocument = useOpenDocument();
  const openDirectory = useOpenDirectory();
  const { isOpen: isDocumentCreationModalOpen, closeCreateDocumentModal } =
    useContext(CreateDocumentModalContext);
  const { isOpen: isCloneFromGithubModalOpen, closeCloneFromGithubModal } =
    useContext(CloneFromGithubModalContext);

  const navigateToDocument = useNavigateToDocument();

  const handleOpenDocument = () => openDocument();
  const handleOpenDirectory = () => openDirectory();

  return (
    <SidebarLayout
      sidebar={
        <StackedResizablePanelsLayout autoSaveId="project-selection-panel-group">
          {window.config.projectType === projectTypes.MULTI_DOCUMENT_PROJECT ? (
            <DirectoryFiles onCreateDocument={triggerDocumentCreationDialog} />
          ) : (
            <RecentProjects onCreateDocument={triggerDocumentCreationDialog} />
          )}
        </StackedResizablePanelsLayout>
      }
    >
      <EmptyMainView
        onCreateDocumentButtonClick={triggerDocumentCreationDialog}
        onOpenDocumentButtonClick={handleOpenDocument}
        onOpenDirectoryButtonClick={handleOpenDirectory}
      />
      <CreateDocumentModal
        isOpen={isDocumentCreationModalOpen}
        onClose={closeCreateDocumentModal}
        onCreateDocument={navigateToDocument}
      />
      <CloneFromGithubDialog
        isOpen={isCloneFromGithubModalOpen}
        onCancel={closeCloneFromGithubModal}
      />
    </SidebarLayout>
  );
};
