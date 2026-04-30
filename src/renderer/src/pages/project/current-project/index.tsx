import { useContext, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router';

import {
  projectTypes,
  urlEncodeProjectId,
} from '../../../../../modules/domain/project';
import { removePath } from '../../../../../modules/infrastructure/filesystem';
import { urlEncodeArtifactId } from '../../../../../modules/infrastructure/version-control';
import {
  BranchingCommandPaletteContext,
  CommitModalContext,
  CreateDocumentModalContext,
  CurrentDocumentContext,
  CurrentProjectContext,
} from '../../../app-state';
import { BranchingCommandPaletteStateProvider } from '../../../app-state';
import {
  useBranchInfo,
  useCommitToProject,
  useCreateDocument,
  useDeleteDirectory,
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
    commitChangesToDocument,
    onCloseRestoreCommitDialog,
    onCloseDiscardChangesDialog,
    onRestoreCommit,
    onDiscardChanges,
  } = useContext(CurrentDocumentContext);
  const { isOpen: isCommitDialogOpen, closeCommitModal } =
    useContext(CommitModalContext);
  const commitChangesToProject = useCommitToProject();
  const { projectType } = useContext(CurrentProjectContext);
  // For single-document projects the project-level commit is the same
  // operation as committing the (sole) document, so we don't surface it as
  // a separate option in the commit dialog.
  const showProjectCommitOption =
    projectType === projectTypes.MULTI_DOCUMENT_PROJECT;
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
  const {
    directoryPathToDelete,
    confirmDeleteDirectory,
    cancelDeleteDirectory,
  } = useDeleteDirectory();
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

  const handleOpenPrintPreview = () => {
    if (projectId && versionedDocumentId) {
      navigate(
        `/projects/${urlEncodeProjectId(projectId)}/documents/${urlEncodeArtifactId(versionedDocumentId)}/print-preview`
      );
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
          onCancel={closeCommitModal}
          canCommit={canCommit}
          primaryAction={{
            label: 'Commit document',
            description:
              'Commit changes to this document and its referenced assets',
            onCommit: (message: string) => commitChangesToDocument(message),
          }}
          secondaryActions={
            showProjectCommitOption
              ? [
                  {
                    label: 'Commit all project changes',
                    description: 'Commit every modified file in the project',
                    onCommit: (message: string) =>
                      commitChangesToProject(message),
                  },
                ]
              : []
          }
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
        <DeleteDirectoryDialog
          isOpen={directoryPathToDelete !== null}
          directoryName={
            directoryPathToDelete ? removePath(directoryPathToDelete) : null
          }
          onCancel={cancelDeleteDirectory}
          onConfirm={confirmDeleteDirectory}
        />
        <ProjectCommandPalette
          onCreateDocument={handleCreateDocument}
          onOpenDocument={handleOpenDocument}
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
export { ProjectHistory, ProjectHistoryDocumentView } from './history';
export { ProjectSettings } from './settings';
export {
  ProjectMergeConflictResolution,
  StructuralConflictResolution,
  CompareContentConflictResolution,
} from './merge-conflict-resolution';
export { PrintPreview } from './print-preview';
