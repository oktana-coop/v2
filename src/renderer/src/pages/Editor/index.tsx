import {
  AutomergeUrl,
  DocHandle,
  isValidAutomergeUrl,
} from '@automerge/automerge-repo';
import { useEffect, useState, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import { VersionedDocument } from '../../automerge';
import { repo } from '../../automerge/repo';
import { Button } from '../../components/actions/Button';
import { Modal } from '../../components/dialogs/Modal';
import { PenIcon } from '../../components/icons';
import { PersonalFile } from '../../components/illustrations/PersonalFile';
import { FileExplorer } from './FileExplorer';
import {
  DirectoryContext,
  createNewFile,
  writeFile,
  getFiles,
  SelectedFileContext,
  SelectedFileProvider,
} from '../../filesystem';
import { DocumentEditor } from './DocumentEditor';
import { InvalidDocument } from '../History/InvalidDocument/InvalidDocument';
import { Layout } from '../../components/layout/Layout';

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

  // TODO: Export this to its own component
  function renderEmptyDocument() {
    return (
      <div className="h-full w-full grow flex flex-col items-center justify-center">
        <h2 className="text-2xl">Welcome to v2 👋</h2>
        <p>
          {directoryHandle
            ? '👈 Pick one document from the list to continue editing. Or create a new one 😉.'
            : 'Create a new document and explore the world of versioning.'}
        </p>
        <p className="m-5">
          <Button
            onClick={() => openCreateDocumentModal(true)}
            variant="solid"
            color="purple"
          >
            <PenIcon />
            Create document
          </Button>
        </p>
        <PersonalFile />
      </div>
    );
  }

  function renderMainPane() {
    if (!docUrl) {
      return renderEmptyDocument();
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
      <div>Loading...</div>
    );
  }

  return (
    <Layout>
      <div className="flex-auto flex">
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
            className="w-full p-2 border border-gray-300 rounded-md"
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
