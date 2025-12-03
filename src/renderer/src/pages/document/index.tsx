import { useContext, useEffect, useState } from 'react';
import { useParams } from 'react-router';

import { projectTypes } from '../../../../modules/domain/project';
import { ProseMirrorProvider } from '../../../../modules/domain/rich-text/react/prosemirror-context';
import { ElectronContext } from '../../../../modules/infrastructure/cross-platform/electron-context';
import { decodeUrlEncodedChangeId } from '../../../../modules/infrastructure/version-control';
import {
  CurrentDocumentContext,
  CurrentDocumentProvider,
  CurrentProjectContext,
  CurrentProjectProvider,
  SidebarLayoutProvider,
} from '../../app-state';
import { Layout } from '../../components/layout/Layout';
import { SidebarLayout } from '../../components/layout/SidebarLayout';
import { StackedResizablePanelsLayout } from '../../components/layout/StackedResizablePanelsLayout';
import { useCreateDocument, useNavigateToDocument } from '../../hooks';
import { useOpenDirectory } from '../../hooks/multi-document-project';
import { useOpenDocument } from '../../hooks/single-document-project';
import {
  CommitDialog,
  DiscardChangesDialog,
  RestoreCommitDialog,
} from './change-dialogs';
import { DocumentCommandPalette } from './command-palette';
import { CreateDocumentModal } from './create-document/CreateDocumentModal';
import { DocumentMainViewRouter } from './main/DocumentMainViewRouter';
import { DocumentHistory } from './sidebar/document-history/DocumentHistory';
import { DirectoryFiles, RecentProjects } from './sidebar/document-list-views';

export const Project = () => {
  const { config } = useContext(ElectronContext);

  return (
    <CurrentProjectProvider projectType={config.projectType}>
      <CurrentDocumentProvider>
        <SidebarLayoutProvider>
          <DocumentIndex />
        </SidebarLayoutProvider>
      </CurrentDocumentProvider>
    </CurrentProjectProvider>
  );
};

export {
  DocumentEditor,
  DocumentHistoricalView,
  DocumentMainViewRouter,
} from './main';

const DocumentIndex = () => {
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
  const { changeId } = useParams();
  const { createNewDocument } = useCreateDocument();
  const openDocument = useOpenDocument();
  const openDirectory = useOpenDirectory();

  useEffect(() => {
    window.document.title = 'v2 | Editor';
  }, []);

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

  const handleOpenDirectory = () => openDirectory();

  return (
    <Layout>
      <div className="flex flex-auto">
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
        <DocumentCommandPalette
          onCreateDocument={handleCreateDocument}
          onOpenDocument={handleOpenDocument}
        />
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
            <DocumentMainViewRouter
              onCreateDocumentButtonClick={handleCreateDocument}
              onOpenDocumentButtonClick={handleOpenDocument}
              onOpenDirectoryButtonClick={handleOpenDirectory}
            />
          </SidebarLayout>
        </ProseMirrorProvider>
      </div>
    </Layout>
  );
};
