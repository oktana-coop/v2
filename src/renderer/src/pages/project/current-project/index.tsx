import { useContext, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router';

import { urlEncodeProjectId } from '../../../../../modules/domain/project';
import { removePath } from '../../../../../modules/infrastructure/filesystem';
import { urlEncodeArtifactId } from '../../../../../modules/infrastructure/version-control';
import {
  BranchingCommandPaletteContext,
  CommitModalContext,
  CurrentDocumentContext,
  ProjectContext,
} from '../../../app-state';
import { BranchingCommandPaletteStateProvider } from '../../../app-state';
import {
  useCommitDocumentChanges,
  useCommitToProject,
  useCreateDocument,
} from '../../../hooks';
import { ProjectCommandPalette } from '../shared/command-palette';
import { BottomBar } from './bottom-bar';
import {
  BranchingCommandPalette,
  CreateBranchDialog,
  DeleteBranchDialog,
} from './branching';
import {
  CommitDialog,
  DeleteDirectoryDialog,
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
    versionedDocumentId,
    isRestoreCommitDialogOpen,
    isDiscardChangesDialogOpen,
    canCommit,
    onCloseRestoreCommitDialog,
    onCloseDiscardChangesDialog,
    onRestoreCommit,
    onDiscardChanges,
  } = useContext(CurrentDocumentContext);
  const { isOpen: isCommitDialogOpen, closeCommitModal } =
    useContext(CommitModalContext);
  const commitChangesToProject = useCommitToProject();
  const commitChangesToDocument = useCommitDocumentChanges();
  const navigate = useNavigate();
  const {
    isOpen: isBranchingCommandPaletteOpen,
    closeBranchingCommandPalette,
  } = useContext(BranchingCommandPaletteContext);
  const { triggerDocumentCreationDialog } = useCreateDocument();
  const {
    projectId,
    filePathToDelete,
    confirmDeleteDocument,
    cancelDeleteDocument,
    directoryPathToDelete,
    confirmDeleteDirectory,
    cancelDeleteDirectory,
    supportsBranching,
    currentBranch,
    createAndSwitchToBranch,
    isCreateBranchDialogOpen,
    closeCreateBranchDialog,
    branchToDelete,
    closeDeleteBranchDialog,
  } = useContext(ProjectContext);

  useEffect(() => {
    window.document.title = 'v2 | Editor';
  }, []);
  const { openBranchingCommandPalette } = useContext(
    BranchingCommandPaletteContext
  );

  const handleOpenCreateDocumentDialog = () => triggerDocumentCreationDialog();

  const handleOpenProjectSettings = () => {
    if (projectId) {
      const projectSettingsUrL = `/projects/${urlEncodeProjectId(projectId)}/settings`;
      navigate(projectSettingsUrL);
    }
  };

  const handleOpenPrintPreview = () => {
    if (projectId && versionedDocumentId) {
      navigate(
        `/projects/${urlEncodeProjectId(projectId)}/artifacts/${urlEncodeArtifactId(versionedDocumentId)}/print-preview`
      );
    }
  };

  return (
    <div className="flex h-full flex-auto flex-col">
      <div className="flex flex-auto overflow-y-auto">
        <CommitDialog
          isOpen={isCommitDialogOpen}
          onCancel={closeCommitModal}
          canCommit={canCommit}
          primaryAction={{
            label: 'Commit document',
            description:
              'Commit changes to this document and its referenced assets',
            onCommit: (message: string) => commitChangesToDocument(message),
          }}
          secondaryActions={[
            {
              label: 'Commit all project changes',
              description: 'Commit every modified file in the project',
              onCommit: (message: string) => commitChangesToProject(message),
            },
          ]}
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
          onConfirm={confirmDeleteDocument}
        />
        <DeleteDirectoryDialog
          isOpen={directoryPathToDelete !== null}
          directoryName={
            directoryPathToDelete ? removePath(directoryPathToDelete) : null
          }
          onCancel={cancelDeleteDirectory}
          onConfirm={confirmDeleteDirectory}
        />
        <ProjectCommandPalette
          onCreateDocument={handleOpenCreateDocumentDialog}
          onOpenProjectSettings={handleOpenProjectSettings}
          onOpenPrintPreview={handleOpenPrintPreview}
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
export { ArtifactRoute } from './artifact-route';
export { ProjectHistory, ProjectHistoryDocumentView } from './history';
export { ProjectSettings } from './settings';
export {
  ProjectMergeConflictResolution,
  StructuralConflictResolution,
  CompareContentConflictResolution,
} from './merge-conflict-resolution';
export { PrintPreview } from './print-preview';
