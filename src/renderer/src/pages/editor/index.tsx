import { useContext, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import {
  SelectedFileContext,
  SelectedFileProvider,
} from '../../../../modules/editor-state';
import {
  SidebarLayoutContext,
  SidebarLayoutProvider,
} from '../../../../modules/editor-state/sidebar-layout/context';
import {
  type File,
  FilesystemContext,
  removeExtension,
} from '../../../../modules/filesystem';
import { ProseMirrorProvider } from '../../../../modules/rich-text/react/context';
import { isValidVersionControlId } from '../../../../modules/version-control';
import { VersionControlContext } from '../../../../modules/version-control/react';
import { Button } from '../../components/actions/Button';
import { CommandPalette } from '../../components/dialogs/command-palette/CommandPalette';
import { Modal } from '../../components/dialogs/Modal';
import { EmptyDocument } from '../../components/document-views/EmptyDocument';
import { InvalidDocument } from '../../components/document-views/InvalidDocument';
import { PenIcon } from '../../components/icons';
import { Layout } from '../../components/layout/Layout';
import { SidebarLayout } from '../../components/layout/SidebarLayout';
import { useKeyBindings } from '../../hooks/useKeyBindings';
import { DocumentEditor } from './DocumentEditor';
import { FileExplorer } from './FileExplorer';

export const Editor = () => {
  return (
    <SelectedFileProvider>
      <EditorIndex />
    </SelectedFileProvider>
  );
};

const EditorIndex = () => {
  const [newDocTitle, setNewDocTitle] = useState<string>('');
  const [isDocumentCreationModalOpen, openCreateDocumentModal] =
    useState<boolean>(false);
  const navigate = useNavigate();
  const { documentId: docUrl } = useParams();
  const {
    directory,
    directoryFiles,
    openDirectory,
    requestPermissionForSelectedDirectory,
    createNewFile,
  } = useContext(FilesystemContext);
  const { selectedFileInfo, setSelectedFileInfo, versionedDocumentHandle } =
    useContext(SelectedFileContext);
  const {
    projectId,
    createDocument: createVersionedDocument,
    findDocumentInProject,
  } = useContext(VersionControlContext);
  const { isSidebarOpen, toggleSidebar } = useContext(SidebarLayoutContext);

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
    navigate(`/edit/${newDocumentId}?path=${encodeURIComponent(file.path!)}`);
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
      path: file.path!,
      name: file.name,
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
      `/edit/${documentHandle.url}?path=${encodeURIComponent(file.path)}`
    );
  };

  function renderMainPane() {
    if (!docUrl) {
      return (
        <EmptyDocument
          message={
            directory
              ? '👈 Pick one document from the list to continue editing. Or create a new one 😉.'
              : 'Create a new document and explore the world of versioning.'
          }
        >
          <Button
            onClick={() => openCreateDocumentModal(true)}
            variant="solid"
            color="purple"
          >
            <PenIcon />
            Create document
          </Button>
        </EmptyDocument>
      );
    }

    if (!isValidVersionControlId(docUrl)) {
      return <InvalidDocument />;
    }

    return versionedDocumentHandle ? (
      <DocumentEditor
        versionedDocumentHandle={versionedDocumentHandle}
        isSidebarOpen={isSidebarOpen}
        onSidebarToggle={toggleSidebar}
      />
    ) : (
      <div className="flex h-full w-full items-center justify-center text-center">
        Loading...
      </div>
    );
  }

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
          <SidebarLayoutProvider>
            <SidebarLayout
              sidebar={
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
              }
            >
              {renderMainPane()}
            </SidebarLayout>
          </SidebarLayoutProvider>
        </ProseMirrorProvider>
      </div>
    </Layout>
  );
};
