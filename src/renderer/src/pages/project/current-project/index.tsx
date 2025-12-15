import { useContext, useEffect, useState } from 'react';
import { Outlet } from 'react-router';
import { useParams } from 'react-router';

import { projectTypes } from '../../../../../modules/domain/project';
import { ProseMirrorProvider } from '../../../../../modules/domain/rich-text/react/prosemirror-context';
import { ElectronContext } from '../../../../../modules/infrastructure/cross-platform/electron-context';
import { decodeUrlEncodedChangeId } from '../../../../../modules/infrastructure/version-control';
import {
  BranchingCommandPaletteContext,
  CurrentDocumentContext,
  CurrentProjectContext,
} from '../../../app-state';
import { BranchingCommandPaletteStateProvider } from '../../../app-state';
import { SidebarLayout } from '../../../components/layout/SidebarLayout';
import { StackedResizablePanelsLayout } from '../../../components/layout/StackedResizablePanelsLayout';
import {
  useBranchInfo,
  useCreateDocument,
  useNavigateToDocument,
} from '../../../hooks';
import { useOpenDocument } from '../../../hooks/single-document-project';
import { ProjectCommandPalette } from '../command-palette';
import { CreateDocumentModal } from '../create-document/CreateDocumentModal';
import { BottomBar } from './bottom-bar';
import {
  BranchingCommandPalette,
  CreateBranchDialog,
  DeleteBranchDialog,
} from './branching';
import {
  CommitDialog,
  DiscardChangesDialog,
  RestoreCommitDialog,
} from './change-dialogs';
import { DocumentHistory } from './document/sidebar/document-history/DocumentHistory';
import {
  DirectoryFiles,
  RecentProjects,
} from './document/sidebar/document-list-views';

export const CurrentProject = () => (
  <BranchingCommandPaletteStateProvider>
    <Project />
  </BranchingCommandPaletteStateProvider>
);

const Project = () => {
  const { isElectron } = useContext(ElectronContext);

  const [isDocumentCreationModalOpen, setCreateDocumentModalOpen] =
    useState<boolean>(false);
  const { projectType } = useContext(CurrentProjectContext);
  const {
    versionedDocumentHistory: changes,
    onSelectChange,
    onCloseCommitDialog,
    isCommitDialogOpen,
    isRestoreCommitDialogOpen,
    isDiscardChangesDialogOpen,
    canCommit,
    onCommit,
    onCloseRestoreCommitDialog,
    onCloseDiscardChangesDialog,
    onRestoreCommit,
    onDiscardChanges,
  } = useContext(CurrentDocumentContext);
  const {
    isOpen: isBranchingCommandPaletteOpen,
    closeBranchingCommandPalette,
  } = useContext(BranchingCommandPaletteContext);
  const { changeId } = useParams();
  const { createNewDocument } = useCreateDocument();
  const openDocument = useOpenDocument();
  const {
    supportsBranching,
    currentBranch,
    createAndSwitchToBranch,
    isCreateBranchDialogOpen,
    closeCreateBranchDialog,
    branchToDelete,
    closeDeleteBranchDialog,
  } = useBranchInfo();

  useEffect(() => {
    window.document.title = 'v2 | Editor';
  }, []);
  const { openBranchingCommandPalette } = useContext(
    BranchingCommandPaletteContext
  );

  const navigateToDocument = useNavigateToDocument();

  const openCreateDocumentModal = () => {
    setCreateDocumentModalOpen(true);
  };

  const closeCreateDocumentModal = () => {
    setCreateDocumentModalOpen(false);
  };

  const handleCreateDocument = async () => {
    if (!isElectron && projectType === projectTypes.SINGLE_DOCUMENT_PROJECT) {
      openCreateDocumentModal();
    } else {
      const { projectId, documentId, path } = await createNewDocument();
      navigateToDocument({ projectId, documentId, path });
    }
  };

  const handleOpenDocument = () => openDocument();

  return (
    <div className="flex h-full flex-auto flex-col">
      <div className="flex flex-auto overflow-y-auto">
        <CreateDocumentModal
          isOpen={isDocumentCreationModalOpen}
          onClose={closeCreateDocumentModal}
          onCreateDocument={navigateToDocument}
        />
        <CommitDialog
          isOpen={isCommitDialogOpen}
          onCancel={onCloseCommitDialog}
          canCommit={canCommit}
          onCommit={(message: string) => onCommit(message)}
        />
        <RestoreCommitDialog
          isOpen={isRestoreCommitDialogOpen}
          onCancel={onCloseRestoreCommitDialog}
          onRestoreCommit={(args) => onRestoreCommit(args)}
        />
        <DiscardChangesDialog
          isOpen={isDiscardChangesDialogOpen}
          onCancel={onCloseDiscardChangesDialog}
          onDiscardChanges={() => onDiscardChanges()}
        />
        <ProjectCommandPalette
          onCreateDocument={handleCreateDocument}
          onOpenDocument={handleOpenDocument}
        />
        <CreateBranchDialog
          isOpen={isCreateBranchDialogOpen}
          onCancel={closeCreateBranchDialog}
          onCreateBranch={(branchName: string) =>
            createAndSwitchToBranch(branchName)
          }
        />
        <DeleteBranchDialog
          branch={branchToDelete}
          onCancel={closeDeleteBranchDialog}
        />
        {currentBranch && (
          <BranchingCommandPalette
            open={isBranchingCommandPaletteOpen}
            onClose={closeBranchingCommandPalette}
            currentBranch={currentBranch}
          />
        )}
        <ProseMirrorProvider>
          <SidebarLayout
            sidebar={
              <StackedResizablePanelsLayout autoSaveId="editor-panel-group">
                {projectType === projectTypes.MULTI_DOCUMENT_PROJECT ? (
                  <DirectoryFiles onCreateDocument={handleCreateDocument} />
                ) : (
                  <RecentProjects onCreateDocument={handleCreateDocument} />
                )}

                <DocumentHistory
                  changes={changes}
                  onChangeClick={onSelectChange}
                  selectedChange={
                    changeId ? decodeUrlEncodedChangeId(changeId) : null
                  }
                />
              </StackedResizablePanelsLayout>
            }
          >
            <Outlet />
          </SidebarLayout>
        </ProseMirrorProvider>
      </div>
      {supportsBranching && (
        <div className="w-full">
          <BottomBar
            currentBranch={currentBranch}
            onBranchButtonClick={openBranchingCommandPalette}
          />
        </div>
      )}
    </div>
  );
};

export { DocumentEditor, DocumentHistoricalView } from './document';
export { ProjectSettings } from './Settings';
