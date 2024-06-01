import { AutomergeUrl, DocHandle } from '@automerge/automerge-repo';
import { useEffect, useState, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { VersionedDocument } from '../automerge';
import { repo } from '../automerge/repo';
import { Button } from '../components/actions/Button';
import { Modal } from '../components/dialogs/Modal';
import { PenIcon } from '../components/icons';
import { PersonalFile } from '../components/illustrations/PersonalFile';
import { FileExplorer } from './FileExplorer';
import { DirectoryContext, createNewFile } from '../filesystem';
import { DocumentEditor } from './DocumentEditor';

const persistDocumentUrl = (docUrl: AutomergeUrl, docTitle: string) => {
  const currentDocUrls = localStorage.getItem('docUrls');
  if (currentDocUrls) {
    const currentDocs = JSON.parse(currentDocUrls);
    localStorage.setItem(
      'docUrls',
      JSON.stringify({
        ...currentDocs,
        [docUrl]: docTitle,
      })
    );
  } else {
    localStorage.setItem(
      'docUrls',
      JSON.stringify({
        [docUrl]: docTitle,
      })
    );
  }
};

export const EditorIndex = () => {
  const [docs, setDocs] = useState<
    Array<{
      id: AutomergeUrl;
      title: string;
    }>
  >([]);
  const [newDocTitle, setNewDocTitle] = useState<string>('');
  const [isDocumentCreationModalOpen, openCreateDocumentModal] =
    useState<boolean>(false);
  const [fileHandle, setFilehandle] = useState<FileSystemFileHandle | null>(
    null
  );
  const navigate = useNavigate();
  const { directory, documentId: docUrl } = useParams();
  const [readyAutomergeHandle, setReadyAutomergeHandle] =
    useState<DocHandle<VersionedDocument> | null>(null);
  const { directoryHandle, setDirectoryHandle: persistDirectoryHandle } =
    useContext(DirectoryContext);

  useEffect(() => {
    document.title = 'v2 | Editor';
  }, []);

  useEffect(() => {
    if (docUrl) {
      const automergeHandle = repo.find<VersionedDocument>(
        docUrl as AutomergeUrl
      );
      automergeHandle.whenReady().then(() => {
        setReadyAutomergeHandle(automergeHandle);
      });
    } else {
      setReadyAutomergeHandle(null);
    }
  }, [docUrl]);

  useEffect(() => {
    const docUrls = localStorage.getItem('docUrls');

    if (docUrls) {
      const docs = JSON.parse(docUrls);
      const docsWithTitles = Object.entries(docs).map(([key, value]) => ({
        id: key as AutomergeUrl,
        title: value as string,
      }));
      setDocs(docsWithTitles);
    }
  }, []);

  async function handleDocumentCreation(docTitle: string) {
    const handle = repo.create<VersionedDocument>();
    const newDocUrl = handle.url;
    handle.change((doc) => {
      doc.title = docTitle;
      doc.content = docTitle;
    });
    // HACK: temporary workaround to persist the document url
    // until we figure out how to handle existing documents persistence
    persistDocumentUrl(newDocUrl, docTitle);
    const fileHandle = await createNewFile(newDocUrl);

    // setSearchParams(new URLSearchParams({ id: newDocUrl }));
    if (fileHandle) {
      setFilehandle(fileHandle);
    }
  }

  const setSelectedDoc = (docUrl: AutomergeUrl) => {
    navigate(`/edit/${directory}/${docUrl}`);
  };

  const setDirectoryHandle = async (
    directoryHandle: FileSystemDirectoryHandle
  ) => {
    await persistDirectoryHandle(directoryHandle);
    navigate(`/edit/${directoryHandle.name}`);
  };

  // TODO: Export this to its own component
  function renderEmptyDocument() {
    return (
      <div className="h-full w-full grow flex flex-col items-center justify-center">
        <h2 className="text-2xl">Welcome to v2 👋</h2>
        <p>
          {docs.length > 0
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

  console.log(docUrl, fileHandle, readyAutomergeHandle);

  return (
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
      {docs.length > 0 && (
        <div className="h-full w-2/5 grow-0 p-5 overflow-y-auto border-r border-gray-300 dark:border-neutral-600">
          <FileExplorer
            directoryHandle={directoryHandle}
            setFilehandle={setFilehandle}
            setDocUrl={setSelectedDoc}
            setDirectoryHandle={setDirectoryHandle}
          />
        </div>
      )}
      {docUrl && fileHandle && readyAutomergeHandle ? (
        <DocumentEditor
          // TODO: Assert that this is indeed an automerge URL
          docUrl={docUrl as AutomergeUrl}
          fileHandle={fileHandle}
          automergeHandle={readyAutomergeHandle}
        />
      ) : (
        renderEmptyDocument()
      )}
    </div>
  );
};
