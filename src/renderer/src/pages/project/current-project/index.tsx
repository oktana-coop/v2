import { useContext, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router';

import { urlEncodeProjectId } from '../../../../../modules/domain/project';
import { removePath } from '../../../../../modules/infrastructure/filesystem';
import {
  BranchingCommandPaletteContext,
  CreateDocumentModalContext,
  CurrentDocumentContext,
} from '../../../app-state';
import { BranchingCommandPaletteStateProvider } from '../../../app-state';
import {
  useBranchInfo,
  useCreateDocument,
  useDeleteDocument,
  useNavigateToDocument,
  useProjectId,
} from '../../../hooks';
import { useOpenDocument } from '../../../hooks/single-document-project';
import { ProjectCommandPalette } from '../shared/command-palette';
import { CreateDocumentModal } from '../shared/create-document/CreateDocumentModal';
import { BottomBar } from './bottom-bar';
import {
  BranchingCommandPalette,
  CreateBranchDialog,
  DeleteBranchDialog,
} from './branching';
import {
  CommitDialog,
  DeleteDocumentDialog,
  DiscardChangesDialog,
  RestoreCommitDialog,
} from './change-dialogs';

export const CurrentProject = () => {
  return (
    <BranchingCommandPaletteStateProvider>
      <Project />
    </BranchingCommandPaletteStateProvider>
  );
};

const Project = () => {
  const {
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
  const navigate = useNavigate();
  const {
    isOpen: isBranchingCommandPaletteOpen,
    closeBranchingCommandPalette,
  } = useContext(BranchingCommandPaletteContext);
  const projectId = useProjectId();
  const { isOpen: isDocumentCreationModalOpen, closeCreateDocumentModal } =
    useContext(CreateDocumentModalContext);

  const { filePathToDelete, deleteDocument, cancelDeleteDocument } =
    useDeleteDocument();
  const { triggerDocumentCreationDialog } = useCreateDocument();
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

  const handleOpenDocument = () => openDocument();

  const handleCreateDocument = () => triggerDocumentCreationDialog();

  const handleOpenProjectSettings = () => {
    if (projectId) {
      const projectSettingsUrL = `/projects/${urlEncodeProjectId(projectId)}/settings`;
      navigate(projectSettingsUrL);
    }
  };

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
        <DeleteDocumentDialog
          isOpen={filePathToDelete !== null}
          documentName={filePathToDelete ? removePath(filePathToDelete) : null}
          onCancel={cancelDeleteDocument}
          onConfirm={deleteDocument}
        />
        <ProjectCommandPalette
          onCreateDocument={handleCreateDocument}
          onOpenDocument={handleOpenDocument}
          onOpenProjectSettings={handleOpenProjectSettings}
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
        <Outlet />
      </div>
      {projectId && supportsBranching && (
        <div className="w-full">
          <BottomBar
            projectId={projectId}
            currentBranch={currentBranch}
            onBranchButtonClick={openBranchingCommandPalette}
          />
        </div>
      )}
    </div>
  );
};

export {
  DocumentEditor,
  DocumentHistoricalView,
  ProjectDocuments,
} from './documents';
export { ProjectSettings } from './settings';
export {
  ProjectMergeConflictResolution,
  StructuralConflictResolution,
  CompareContentConflictResolution,
} from './merge-conflict-resolution';
