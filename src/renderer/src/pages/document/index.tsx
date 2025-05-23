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
import { Button } from '../../components/actions/Button';
import { CommandPalette } from '../../components/dialogs/command-palette/CommandPalette';
import { Modal } from '../../components/dialogs/Modal';
import { Layout } from '../../components/layout/Layout';
import { SidebarLayout } from '../../components/layout/SidebarLayout';
import { StackedResizablePanelsLayout } from '../../components/layout/StackedResizablePanelsLayout';
import { useKeyBindings } from '../../hooks/useKeyBindings';
import { CommitDialog } from './commit/CommitDialog';
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
  const [newDocTitle, setNewDocTitle] = useState<string>('');
  const [isDocumentCreationModalOpen, openCreateDocumentModal] =
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
    'ctrl+d': () => openCreateDocumentModal(true),
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

  return (
    <Layout>
      <div className="flex flex-auto">
        <Modal
          isOpen={isDocumentCreationModalOpen}
          title="Give your document a title"
          onClose={() => {
            setNewDocTitle('');
            openCreateDocumentModal(false);
          }}
          secondaryButton={
            <Button
              variant="plain"
              onClick={() => {
                setNewDocTitle('');
                openCreateDocumentModal(false);
              }}
            >
              Cancel
            </Button>
          }
          primaryButton={
            <Button
              disabled={newDocTitle.length === 0}
              onClick={async () => {
                await handleDocumentCreation(newDocTitle);
                setNewDocTitle('');
                openCreateDocumentModal(false);
              }}
              color="purple"
            >
              Create
            </Button>
          }
        >
          <input
            type="text"
            value={newDocTitle}
            autoFocus={true}
            onChange={(e) => setNewDocTitle(e.target.value)}
            className="w-full rounded-md border border-gray-300 p-2"
          />
        </Modal>
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
              onActionSelection: () => {
                openCreateDocumentModal(true);
              },
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
                  onCreateDocument={() => openCreateDocumentModal(true)}
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
              onCreateDocumentButtonClick={() => openCreateDocumentModal(true)}
            />
          </SidebarLayout>
        </ProseMirrorProvider>
      </div>
    </Layout>
  );
};
