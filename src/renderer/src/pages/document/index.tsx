import { useContext, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import {
  SelectedFileContext,
  SelectedFileProvider,
} from '../../../../modules/editor-state';
import { SidebarLayoutProvider } from '../../../../modules/editor-state/sidebar-layout/context';
import {
  type File,
  FilesystemContext,
  removeExtension,
} from '../../../../modules/filesystem';
import { ProseMirrorProvider } from '../../../../modules/rich-text/react/context';
import { decodeURLHeads } from '../../../../modules/version-control';
import { VersionControlContext } from '../../../../modules/version-control/react';
import { CommandPalette } from '../../components/dialogs/command-palette/CommandPalette';
import { Layout } from '../../components/layout/Layout';
import { SidebarLayout } from '../../components/layout/SidebarLayout';
import { StackedResizablePanelsLayout } from '../../components/layout/StackedResizablePanelsLayout';
import { useKeyBindings } from '../../hooks/useKeyBindings';
import { CommitDialog } from './commit/CommitDialog';
import { CreateDocumentModal } from './create-document/CreateDocumentModal';
import { DocumentMainViewRouter } from './main/DocumentMainViewRouter';
import { DocumentHistory } from './sidebar/document-history/DocumentHistory';
import { FileExplorer } from './sidebar/file-explorer/FileExplorer';

export const Document = () => (
  <SelectedFileProvider>
    <SidebarLayoutProvider>
      <DocumentIndex />
    </SidebarLayoutProvider>
  </SelectedFileProvider>
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
    directory,
    directoryFiles,
    openDirectory,
    requestPermissionForSelectedDirectory,
    createNewFile,
  } = useContext(FilesystemContext);
  const {
    selectedFileInfo,
    setSelectedFileInfo,
    versionedDocumentHistory: commits,
    onSelectCommit,
    onCloseCommitDialog,
    isCommitDialogOpen,
    canCommit,
    onCommit,
  } = useContext(SelectedFileContext);
  const {
    projectId,
    createDocument: createVersionedDocument,
    findDocumentInProject,
  } = useContext(VersionControlContext);
  const { changeId } = useParams();
  const [isCommandPaletteOpen, setCommandPaletteOpen] =
    useState<boolean>(false);

  useKeyBindings({
    'ctrl+k': () => setCommandPaletteOpen((state) => !state),
    'ctrl+d': () => openCreateDocumentModal(),
  });

  useEffect(() => {
    document.title = 'v2 | Editor';
  }, []);

  const handleDocumentCreation = async (title: string) => {
    const file = await createNewFile(title);
    const newDocumentId = await createVersionedDocument({
      name: file.name,
      title,
      path: file.path!,
      projectId,
      content: null,
    });

    setSelectedFileInfo({ documentId: newDocumentId, path: file.path! });
    navigate(
      `/documents/${newDocumentId}?path=${encodeURIComponent(file.path!)}`
    );
  };

  const handleOpenDirectory = async () => {
    await openDirectory();
  };

  const handlePermissionRequest = async () => {
    await requestPermissionForSelectedDirectory();
  };

  const handleFileSelection = async (file: File) => {
    if (!projectId) {
      // TODO: Handle more gracefully
      throw new Error('Could not select file because no project ID was found');
    }

    const documentHandle = await findDocumentInProject({
      projectId,
      documentPath: file.path!,
    });

    if (!documentHandle) {
      // TODO: Handle more gracefully
      throw new Error(
        'Could not select file because the versioned document was not found in project'
      );
    }

    if (!file.path) {
      // TODO: Handle more gracefully
      throw new Error('Could not select file because the file path is missing');
    }

    await setSelectedFileInfo({
      documentId: documentHandle.url,
      path: file.path,
    });
    navigate(
      `/documents/${documentHandle.url}?path=${encodeURIComponent(file.path)}`
    );
  };

  const openCreateDocumentModal = () => {
    setCreateDocumentModalOpen(true);
  };

  const closeCreateDocumentModal = () => {
    setCreateDocumentModalOpen(false);
  };

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
        <CommandPalette
          open={isCommandPaletteOpen}
          onClose={() => setCommandPaletteOpen(false)}
          documentsGroupTitle={'Recent documents'}
          documents={directoryFiles.map((file) => ({
            title: removeExtension(file.name),
            onDocumentSelection: () => {
              handleFileSelection(file);
              setCommandPaletteOpen(false);
            },
          }))}
          actions={[
            {
              name: 'Create new document',
              shortcut: 'D',
              onActionSelection: openCreateDocumentModal,
            },
          ]}
        />
        <ProseMirrorProvider>
          <SidebarLayout
            sidebar={
              <StackedResizablePanelsLayout autoSaveId="editor-panel-group">
                <FileExplorer
                  directory={directory}
                  files={directoryFiles}
                  selectedFileInfo={selectedFileInfo}
                  onOpenDirectory={handleOpenDirectory}
                  onRequestPermissionsForCurrentDirectory={
                    handlePermissionRequest
                  }
                  onFileSelection={handleFileSelection}
                  onCreateDocument={openCreateDocumentModal}
                />
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
            />
          </SidebarLayout>
        </ProseMirrorProvider>
      </div>
    </Layout>
  );
};
