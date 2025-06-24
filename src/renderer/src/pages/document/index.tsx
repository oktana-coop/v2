import { useContext, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { projectTypes } from '../../../../modules/domain/project';
import { ProseMirrorProvider } from '../../../../modules/domain/rich-text/react/context';
import { ElectronContext } from '../../../../modules/infrastructure/cross-platform/electron-context';
import {
  decodeURLHeads,
  type VersionControlId,
} from '../../../../modules/infrastructure/version-control';
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
import { useCreateDocument } from '../../hooks';
import { useOpenDirectory } from '../../hooks/multi-document-project';
import { useOpenDocument } from '../../hooks/single-document-project';
import { DocumentCommandPalette } from './command-palette';
import { CommitDialog } from './commit/CommitDialog';
import { CreateDocumentModal } from './create-document/CreateDocumentModal';
import { DocumentMainViewRouter } from './main/DocumentMainViewRouter';
import { DocumentHistory } from './sidebar/document-history/DocumentHistory';
import { DirectoryFiles, RecentProjects } from './sidebar/document-list-views';

export const Document = () => (
  <CurrentProjectProvider projectType={projectTypes.SINGLE_DOCUMENT_PROJECT}>
    <CurrentDocumentProvider>
      <SidebarLayoutProvider>
        <DocumentIndex />
      </SidebarLayoutProvider>
    </CurrentDocumentProvider>
  </CurrentProjectProvider>
);

export {
  DocumentEditor,
  DocumentHistoricalView,
  DocumentMainViewRouter,
} from './main';

const DocumentIndex = () => {
  const { isElectron } = useContext(ElectronContext);

  const [isDocumentCreationModalOpen, setCreateDocumentModalOpen] =
    useState<boolean>(false);
  const navigate = useNavigate();
  const { projectType } = useContext(CurrentProjectContext);
  const {
    setSelectedFileInfo,
    versionedDocumentHistory: commits,
    onSelectCommit,
    onCloseCommitDialog,
    isCommitDialogOpen,
    canCommit,
    onCommit,
  } = useContext(CurrentDocumentContext);
  const { changeId } = useParams();
  const { createNewDocument } = useCreateDocument();
  const openDocument = useOpenDocument();
  const openDirectory = useOpenDirectory();

  useEffect(() => {
    window.document.title = 'v2 | Editor';
  }, []);

  const navigateToDocument = ({
    documentId,
    path,
  }: {
    documentId: VersionControlId;
    path: string | null;
  }) => {
    setSelectedFileInfo({ documentId, path });

    const newUrl = path
      ? `/documents/${documentId}?path=${encodeURIComponent(path)}`
      : `/documents/${documentId}`;
    navigate(newUrl);
  };

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
      const { documentId, path } = await createNewDocument();
      navigateToDocument({ documentId, path });
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
                  commits={commits}
                  onCommitClick={onSelectCommit}
                  selectedCommit={changeId ? decodeURLHeads(changeId) : null}
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
