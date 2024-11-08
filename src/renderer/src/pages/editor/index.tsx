import { useContext, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import {
  type File,
  FilesystemContext,
  SelectedFileContext,
  SelectedFileProvider,
} from '../../../../modules/filesystem';
import {
  createDocument,
  type DocHandle,
  isValidAutomergeUrl,
  useRepo,
  type VersionedDocument,
} from '../../../../modules/version-control';
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
  const navigate = useNavigate();
  const { documentId: docUrl } = useParams();
  const [readyAutomergeHandle, setReadyAutomergeHandle] =
    useState<DocHandle<VersionedDocument> | null>(null);
  const {
    directory,
    openDirectory,
    listSelectedDirectoryFiles,
    requestPermissionForSelectedDirectory,
    createNewFile,
    writeFile,
  } = useContext(FilesystemContext);
  const { selectedFileInfo, setSelectedFileInfo, clearFileSelection } =
    useContext(SelectedFileContext);
  const [files, setFiles] = useState<Array<File>>([]);
  const repo = useRepo();

  useEffect(() => {
    document.title = 'v2 | Editor';
  }, []);

  useEffect(() => {
    if (!docUrl) {
      return;
    }

    if (isValidAutomergeUrl(docUrl)) {
      const automergeHandle = repo.find<VersionedDocument>(docUrl);
      automergeHandle.whenReady().then(() => {
        setReadyAutomergeHandle(automergeHandle);
      });
    } else {
      setReadyAutomergeHandle(null);
    }
  }, [repo, docUrl, clearFileSelection]);

  useEffect(() => {
    const getFiles = async () => {
      const files = await listSelectedDirectoryFiles();
      setFiles(files);
    };

    if (directory && directory.permissionState === 'granted') {
      getFiles();
    }
  }, [directory, selectedFileInfo]);

  const handleDocumentCreation = async (docTitle: string) => {
    const newDocumentId = await createDocument(repo)(docTitle);
    const file = await createNewFile();
    setSelectedFileInfo({ documentId: newDocumentId, path: file.path! });
  };

  const handleDocumentChange = (newContent: string) => {
    if (!selectedFileInfo || !selectedFileInfo.path) {
      // TODO: Handle more gracefully
      throw new Error(
        'Could not find file path from file selection data. Aborting file write operation'
      );
    }

    writeFile(selectedFileInfo.path, newContent);
  };

  const handleOpenDirectory = async () => {
    await openDirectory();
  };

  const handlePermissionRequest = async () => {
    await requestPermissionForSelectedDirectory();
  };

  const handleFileSelection = async (file: File) => {
    if (!docUrl || !isValidAutomergeUrl(docUrl)) {
      // TODO: Handle more gracefully
      throw new Error(
        'Could not select file because the document ID is unavailable or malformed'
      );
    }

    await setSelectedFileInfo({ documentId: docUrl, path: file.path! });
    navigate(`/edit/${docUrl}`);
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

    if (!isValidAutomergeUrl(docUrl)) {
      return <InvalidDocument />;
    }

    return readyAutomergeHandle ? (
      <DocumentEditor
        automergeHandle={readyAutomergeHandle}
        onDocumentChange={handleDocumentChange}
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
        <div className="h-full w-2/5 grow-0 overflow-y-auto border-r border-gray-300 dark:border-neutral-600">
          <FileExplorer
            directory={directory}
            files={files}
            selectedFileInfo={selectedFileInfo}
            onOpenDirectory={handleOpenDirectory}
            onRequestPermissionsForCurrentDirectory={handlePermissionRequest}
            onFileSelection={handleFileSelection}
          />
        </div>
        {renderMainPane()}
      </div>
    </Layout>
  );
};
