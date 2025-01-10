import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  ImperativePanelHandle,
  Panel,
  PanelGroup,
  PanelResizeHandle,
} from 'react-resizable-panels';
import { useNavigate, useParams } from 'react-router-dom';

import {
  SelectedFileContext,
  SelectedFileProvider,
} from '../../../../modules/editor-state';
import { type File, FilesystemContext } from '../../../../modules/filesystem';
import { ProseMirrorProvider } from '../../../../modules/rich-text/react/context';
import { isValidVersionControlId } from '../../../../modules/version-control';
import { VersionControlContext } from '../../../../modules/version-control/react';
import { Button } from '../../components/actions/Button';
import { Modal } from '../../components/dialogs/Modal';
import { EmptyDocument } from '../../components/document-views/EmptyDocument';
import { InvalidDocument } from '../../components/document-views/InvalidDocument';
import { PenIcon } from '../../components/icons';
import { Layout } from '../../components/layout/Layout';
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
  const [isSidebarOpen, toggleSidebarOpen] = useState<boolean>(true);
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
  const sidebarPanelRef = useRef<ImperativePanelHandle | null>(null);

  useEffect(() => {
    document.title = 'v2 | Editor';
  }, []);

  const handleDocumentCreation = async (title: string) => {
    const file = await createNewFile();
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

  const handleSidebarToggle = useCallback(() => {
    const sidebarPanel = sidebarPanelRef.current;
    if (!sidebarPanel) {
      return;
    }

    if (sidebarPanel.isExpanded()) {
      sidebarPanel.collapse();
    } else {
      sidebarPanel.expand();
    }
  }, [sidebarPanelRef]);

  const handleSidebarPanelCollapse = () => {
    toggleSidebarOpen(false);
  };

  const handleSidebarPanelExpand = () => {
    toggleSidebarOpen(true);
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
        onSidebarToggle={handleSidebarToggle}
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
        <ProseMirrorProvider>
          <PanelGroup autoSaveId="editor-panel-group" direction="horizontal">
            <Panel
              ref={sidebarPanelRef}
              collapsible
              defaultSize={27}
              onCollapse={handleSidebarPanelCollapse}
              onExpand={handleSidebarPanelExpand}
            >
              {isSidebarOpen && (
                <div className="h-full overflow-y-auto border-r border-gray-300 dark:border-neutral-600">
                  <FileExplorer
                    directory={directory}
                    files={directoryFiles}
                    selectedFileInfo={selectedFileInfo}
                    onOpenDirectory={handleOpenDirectory}
                    onRequestPermissionsForCurrentDirectory={
                      handlePermissionRequest
                    }
                    onFileSelection={handleFileSelection}
                  />
                </div>
              )}
            </Panel>
            <PanelResizeHandle />
            <Panel className="flex">{renderMainPane()}</Panel>
          </PanelGroup>
        </ProseMirrorProvider>
      </div>
    </Layout>
  );
};
