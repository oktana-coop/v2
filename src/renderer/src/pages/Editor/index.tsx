import {
  AutomergeUrl,
  DocHandle,
  isValidAutomergeUrl,
} from '@automerge/automerge-repo';
import { useContext, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { Button } from '../../components/actions/Button';
import { Modal } from '../../components/dialogs/Modal';
import { EmptyDocument } from '../../components/document-views/EmptyDocument';
import { InvalidDocument } from '../../components/document-views/InvalidDocument';
import { PenIcon } from '../../components/icons';
import { Layout } from '../../components/layout/Layout';
import {
  createNewFile,
  DirectoryContext,
  getFiles,
  SelectedFileContext,
  SelectedFileProvider,
  writeFile,
} from '../../modules/filesystem';
import { VersionedDocument } from '../../modules/version-control';
import { repo } from '../../modules/version-control/repo';
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
    directoryPermissionState,
    directoryHandle,
    setDirectoryHandle: persistDirectoryHandle,
    setDirectoryPermissionState,
  } = useContext(DirectoryContext);
  const {
    selectedFileInfo,
    setSelectedFileInfo: persistSelectedFileInfo,
    clearFileSelection,
  } = useContext(SelectedFileContext);
  const [files, setFiles] = useState<
    Array<{ filename: string; handle: FileSystemFileHandle }>
  >([]);

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
  }, [docUrl, clearFileSelection]);

  useEffect(() => {
    const getDirectoryFiles = async (
      directoryHandle: FileSystemDirectoryHandle
    ) => {
      const files = await getFiles(directoryHandle);
      setFiles(files);
    };

    if (directoryHandle && directoryPermissionState === 'granted') {
      getDirectoryFiles(directoryHandle);
    }
  }, [directoryHandle, directoryPermissionState, selectedFileInfo]);

  const handleDocumentCreation = async (docTitle: string) => {
    const handle = repo.create<VersionedDocument>();
    const newDocUrl = handle.url;
    handle.change((doc) => {
      doc.title = docTitle;
      doc.content = docTitle;
    });

    const fileHandle = await createNewFile(newDocUrl);
    if (fileHandle) {
      handleFileSelection(newDocUrl, fileHandle);
    }
  };

  const handleDocumentChange = (docUrl: AutomergeUrl, value: string) => {
    // TODO: The fileHandle should be set when the document is selected
    // or on initial page load
    if (!selectedFileInfo?.fileHandle) {
      console.error('fileHandle has not been initialized');
      return;
    }

    const fileContent = {
      docUrl,
      value,
    };

    writeFile(selectedFileInfo.fileHandle, fileContent);
  };

  const handleFileSelection = async (
    docUrl: AutomergeUrl,
    fileHandle: FileSystemFileHandle
  ) => {
    await persistSelectedFileInfo({ automergeUrl: docUrl, fileHandle });
    navigate(`/edit/${docUrl}`);
  };

  const setDirectoryHandle = async (
    directoryHandle: FileSystemDirectoryHandle
  ) => {
    await persistDirectoryHandle(directoryHandle);
  };

  function renderMainPane() {
    if (!docUrl) {
      return (
        <EmptyDocument
          message={
            directoryHandle
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
            directoryPermissionState={directoryPermissionState}
            setDirectoryPermissionState={setDirectoryPermissionState}
            directoryHandle={directoryHandle}
            files={files}
            selectedFileHandle={selectedFileInfo?.fileHandle || null}
            setDirectoryHandle={setDirectoryHandle}
            onFileSelection={handleFileSelection}
          />
        </div>
        {renderMainPane()}
      </div>
    </Layout>
  );
};
