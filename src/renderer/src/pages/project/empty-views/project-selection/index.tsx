import { useCallback, useContext, useState } from 'react';
import { useNavigate } from 'react-router';

import { urlEncodeShareId } from '../../../../../../modules/domain/project';
import {
  CloneFromGithubModalContext,
  ProjectContext,
  useCreateDocument,
} from '../../../../app-state';
import { SidebarLayout } from '../../../../components/layout/SidebarLayout';
import { StackedResizablePanelsLayout } from '../../../../components/layout/StackedResizablePanelsLayout';
import { CloneFromGithubDialog } from '../../../shared/sync-providers/github/CloneFromGithubDialog';
import { JoinSharedDocumentDialog } from '../../current-project/sharing-dialogs';
import { DirectoryTreeView } from '../../shared/explorer-tree-views';
import { EmptyMainView } from '../empty-main-view';
import { JoinSharedDocumentButton, SharedWithMeButton } from './guest-buttons';

export const ProjectSelection = () => {
  const { triggerDocumentCreationDialog } = useCreateDocument();
  const { openDirectory } = useContext(ProjectContext);
  const { isOpen: isCloneFromGithubModalOpen, closeCloneFromGithubModal } =
    useContext(CloneFromGithubModalContext);
  const [isJoinDialogOpen, setIsJoinDialogOpen] = useState(false);
  const navigate = useNavigate();

  const handleOpenDirectory = () => openDirectory();

  const handleJoinAsGuest = useCallback(
    async (shareId: string) => {
      setIsJoinDialogOpen(false);
      navigate(`/shared-documents/${urlEncodeShareId(shareId)}`);
      return null;
    },
    [navigate]
  );

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
      >
        <JoinSharedDocumentButton onClick={() => setIsJoinDialogOpen(true)} />
        <SharedWithMeButton onClick={() => navigate('/shared-documents')} />
      </EmptyMainView>
      <CloneFromGithubDialog
        isOpen={isCloneFromGithubModalOpen}
        onCancel={closeCloneFromGithubModal}
      />
      <JoinSharedDocumentDialog
        isOpen={isJoinDialogOpen}
        description="Paste the share ID you were sent. It opens the shared document here, without its project."
        onJoin={handleJoinAsGuest}
        onCancel={() => setIsJoinDialogOpen(false)}
      />
    </SidebarLayout>
  );
};
