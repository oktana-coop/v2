import { useContext, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import {
  CurrentDocumentContext,
  CurrentDocumentProvider,
  CurrentProjectProvider,
  SidebarLayoutProvider,
} from '../../../../modules/app-state';
import { projectTypes } from '../../../../modules/domain/project';
import { ProseMirrorProvider } from '../../../../modules/domain/rich-text/react/context';
import {
  decodeURLHeads,
  type VersionControlId,
} from '../../../../modules/infrastructure/version-control';
import { Layout } from '../../components/layout/Layout';
import { SidebarLayout } from '../../components/layout/SidebarLayout';
import { StackedResizablePanelsLayout } from '../../components/layout/StackedResizablePanelsLayout';
import { DocumentCommandPalette } from './command-palette';
import { CommitDialog } from './commit/CommitDialog';
import { CreateDocumentModal } from './create-document/CreateDocumentModal';
import { DocumentMainViewRouter } from './main/DocumentMainViewRouter';
import { DocumentHistory } from './sidebar/document-history/DocumentHistory';
import { FileExplorer } from './sidebar/file-explorer/FileExplorer';

export const Document = () => (
  <CurrentProjectProvider projectType={projectTypes.MULTI_DOCUMENT_PROJECT}>
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
  const [isDocumentCreationModalOpen, setCreateDocumentModalOpen] =
    useState<boolean>(false);
  const navigate = useNavigate();
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

  useEffect(() => {
    document.title = 'v2 | Editor';
  }, []);

  const handleDocumentCreation = ({
    documentId,
    path,
  }: {
    documentId: VersionControlId;
    path: string;
  }) => {
    setSelectedFileInfo({ documentId, path });
    navigate(`/documents/${documentId}?path=${encodeURIComponent(path)}`);
  };

  const openCreateDocumentModal = () => {
    setCreateDocumentModalOpen(true);
  };

  const closeCreateDocumentModal = () => {
    setCreateDocumentModalOpen(false);
  };

  const handleOpenDocument = () => {};

  return (
    <Layout>
      <div className="flex flex-auto">
        <CreateDocumentModal
          isOpen={isDocumentCreationModalOpen}
          onClose={closeCreateDocumentModal}
          onCreateDocument={handleDocumentCreation}
        />
        <CommitDialog
          isOpen={isCommitDialogOpen}
          onCancel={onCloseCommitDialog}
          canCommit={canCommit}
          onCommit={(message: string) => onCommit(message)}
        />
        <DocumentCommandPalette onCreateDocument={openCreateDocumentModal} />
        <ProseMirrorProvider>
          <SidebarLayout
            sidebar={
              <StackedResizablePanelsLayout autoSaveId="editor-panel-group">
                <FileExplorer onCreateDocument={openCreateDocumentModal} />
                <DocumentHistory
                  commits={commits}
                  onCommitClick={onSelectCommit}
                  selectedCommit={changeId ? decodeURLHeads(changeId) : null}
                />
              </StackedResizablePanelsLayout>
            }
          >
            <DocumentMainViewRouter
              onCreateDocumentButtonClick={openCreateDocumentModal}
              onOpenDocumentButtonClick={handleOpenDocument}
            />
          </SidebarLayout>
        </ProseMirrorProvider>
      </div>
    </Layout>
  );
};
