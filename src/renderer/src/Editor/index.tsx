import * as Automerge from '@automerge/automerge';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { repo } from '../automerge/repo';
import { Button } from '../components/actions/Button';
import { Link } from '../components/actions/Link';
import { PenIcon } from '../components/icons';
import { PersonalFile } from '../components/illustrations/PersonalFile';
import { AutomergeUrl } from '@automerge/automerge-repo';

const persistDocumentUrl = (docUrl: AutomergeUrl) => {
  const currentDocUrls = localStorage.getItem('docUrls');
  if (currentDocUrls) {
    const currentDocs = JSON.parse(currentDocUrls);
    localStorage.setItem(
      'docUrls',
      JSON.stringify({
        ...currentDocs,
        [docUrl]: docUrl,
      })
    );
  } else {
    localStorage.setItem(
      'docUrls',
      JSON.stringify({
        [docUrl]: docUrl,
      })
    );
  }
};

export const EditorIndex = () => {
  const navigate = useNavigate();
  const [docIds, setDocIds] = useState<Array<string>>([]);

  useEffect(() => {
    const docUrls = localStorage.getItem('docUrls');
    if (docUrls) {
      const docs = JSON.parse(docUrls);
      setDocIds(Object.keys(docs));
    }
  }, []);

  const handleDocumentCreation = () => {
    const handle = repo.create<{ doc?: Automerge.Doc<string> }>();
    const newDocUrl = handle.url;
    // temporary workaround to persist the document url
    // until we figure out how to handle existing documents persistence
    persistDocumentUrl(newDocUrl);
    navigate(`/edit/${newDocUrl}`);
  };

  return (
    <div className="flex-auto flex">
      {docIds.length > 0 && (
        <div className="h-full w-2/5 grow-0 p-5 overflow-y-scroll ">
          <h2>Your docs</h2>
          {docIds.map((docId) => (
            <div className="text-left" key={docId}>
              <Link to={`/edit/${docId}`}>{docId}</Link>
            </div>
          ))}
        </div>
      )}
      <div className="h-full w-full grow flex flex-col items-center justify-center">
        <h2 className="text-2xl">Welcome to v2 👋</h2>
        <p className="text-gray-500">
          {docIds.length > 0
            ? '👈 Pick one documents of the list to continue editing. Or create a new one 😉'
            : 'Create a new document and explore the world of versioning'}
        </p>
        <p className="m-5">
          <Button
            onClick={handleDocumentCreation}
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
