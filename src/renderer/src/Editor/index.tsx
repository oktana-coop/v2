import { AutomergeUrl } from '@automerge/automerge-repo';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { VersionedDocument } from '../automerge';
import { repo } from '../automerge/repo';
import { Button } from '../components/actions/Button';
import { Link } from '../components/actions/Link';
import { Modal } from '../components/dialogs/Modal';
import { PenIcon, FolderIcon } from '../components/icons';
import { PersonalFile } from '../components/illustrations/PersonalFile';
import { SidebarHeading } from '../components/sidebar/SidebarHeading';

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
  const navigate = useNavigate();
  const [docs, setDocs] = useState<
    Array<{
      id: AutomergeUrl;
      title: string;
    }>
  >([]);
  const [newDocTitle, setNewDocTitle] = useState<string>('');
  const [isDocumentCreationModalOpen, openCreateDocumentModal] =
    useState<boolean>(false);

  useEffect(() => {
    document.title = 'v2 | Editor';
  }, []);

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

  const handleDocumentCreation = (docTitle: string) => {
    const handle = repo.create<VersionedDocument>();
    const newDocUrl = handle.url;
    handle.change((doc) => {
      doc.title = docTitle;
      doc.content = docTitle;
    });
    // temporary workaround to persist the document url
    // until we figure out how to handle existing documents persistence
    persistDocumentUrl(newDocUrl, docTitle);
    navigate(`/edit/${newDocUrl}`);
  };

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
            onClick={() => {
              handleDocumentCreation(newDocTitle);
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
          <SidebarHeading icon={FolderIcon} text="File Explorer" />
          {docs.map((doc) => (
            <div className="text-left" key={doc.id}>
              <Link to={`/edit/${doc.id}`}>{doc.title}</Link>
            </div>
          ))}
        </div>
      )}
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
    </div>
  );
};
