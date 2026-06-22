import { useContext } from 'react';

import {
  CloneFromGithubModalContext,
  ProjectContext,
} from '../../../../app-state';
import { SidebarLayout } from '../../../../components/layout/SidebarLayout';
import { StackedResizablePanelsLayout } from '../../../../components/layout/StackedResizablePanelsLayout';
import { useCreateDocument } from '../../../../hooks';
import { CloneFromGithubDialog } from '../../../shared/sync-providers/github/CloneFromGithubDialog';
import { DirectoryTreeView } from '../../shared/explorer-tree-views';
import { EmptyMainView } from '../empty-main-view';

export const ProjectSelection = () => {
  const { triggerDocumentCreationDialog } = useCreateDocument();
  const { openDirectory } = useContext(ProjectContext);
  const { isOpen: isCloneFromGithubModalOpen, closeCloneFromGithubModal } =
    useContext(CloneFromGithubModalContext);

  const handleOpenDirectory = () => openDirectory();

  return (
    <SidebarLayout
      sidebar={
        <StackedResizablePanelsLayout autoSaveId="project-selection-panel-group">
          <DirectoryTreeView onCreateDocument={triggerDocumentCreationDialog} />
        </StackedResizablePanelsLayout>
      }
    >
      <EmptyMainView
        onCreateDocumentButtonClick={triggerDocumentCreationDialog}
        onOpenDirectoryButtonClick={handleOpenDirectory}
      />
      <CloneFromGithubDialog
        isOpen={isCloneFromGithubModalOpen}
        onCancel={closeCloneFromGithubModal}
      />
    </SidebarLayout>
  );
};
