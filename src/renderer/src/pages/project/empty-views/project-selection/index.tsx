import { type ComponentProps, useContext } from 'react';

import { projectTypes } from '../../../../../../modules/domain/project';
import {
  CloneFromGithubModalContext,
  CreateDocumentModalContext,
} from '../../../../app-state';
import { SidebarLayout } from '../../../../components/layout/SidebarLayout';
import { StackedResizablePanelsLayout } from '../../../../components/layout/StackedResizablePanelsLayout';
import { useCreateDocument, useNavigateToArtifact } from '../../../../hooks';
import { useOpenDirectory } from '../../../../hooks/multi-document-project';
import { useOpenDocument } from '../../../../hooks/single-document-project';
import { CloneFromGithubDialog } from '../../../shared/sync-providers/github/CloneFromGithubDialog';
import { CreateDocumentModal } from '../../shared/create-document/CreateDocumentModal';
import {
  DirectoryTreeView,
  RecentProjects,
} from '../../shared/explorer-tree-views';
import { EmptyMainView } from '../empty-main-view';

export const ProjectSelection = () => {
  const { triggerDocumentCreationDialog } = useCreateDocument();
  const openDocument = useOpenDocument();
  const openDirectory = useOpenDirectory();
  const { isOpen: isDocumentCreationModalOpen, closeCreateDocumentModal } =
    useContext(CreateDocumentModalContext);
  const { isOpen: isCloneFromGithubModalOpen, closeCloneFromGithubModal } =
    useContext(CloneFromGithubModalContext);

  const navigateToArtifact = useNavigateToArtifact();

  const handleOpenDocument = () => openDocument();
  const handleOpenDirectory = () => openDirectory();

  const handleCreateDocument: ComponentProps<
    typeof CreateDocumentModal
  >['onCreateDocument'] = ({ projectId, documentId, path }) => {
    navigateToArtifact({ projectId, artifactId: documentId, path });
  };

  return (
    <SidebarLayout
      sidebar={
        <StackedResizablePanelsLayout autoSaveId="project-selection-panel-group">
          {window.config.projectType === projectTypes.MULTI_DOCUMENT_PROJECT ? (
            <DirectoryTreeView
              onCreateDocument={triggerDocumentCreationDialog}
            />
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
        onCreateDocument={handleCreateDocument}
      />
      <CloneFromGithubDialog
        isOpen={isCloneFromGithubModalOpen}
        onCancel={closeCloneFromGithubModal}
      />
    </SidebarLayout>
  );
};
