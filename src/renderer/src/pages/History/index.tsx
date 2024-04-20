import { useEffect, useState } from 'react';
import { Link } from '../../components/actions/Link';
import { PersonalFile } from '../../components/illustrations/PersonalFile';
import { AutomergeUrl } from '@automerge/automerge-repo';

export const HistoryIndex = () => {
  const [docs, setDocs] = useState<
    Array<{
      id: AutomergeUrl;
      title: string;
    }>
  >([]);

  useEffect(() => {
    document.title = 'v2 | Version History';
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

  return (
    <div className="flex-auto flex">
      <div className="h-full w-2/5 grow-0 p-5 overflow-y-scroll border-r border-gray-300 dark:border-neutral-600">
        <h2>My documents</h2>
        {docs.map((doc) => (
          <div className="text-left" key={doc.id}>
            <Link to={`/history/${doc.id}`}>{doc.title}</Link>
          </div>
        ))}
      </div>
      <div className="h-full w-full grow flex flex-col items-center justify-center">
        <h2 className="text-2xl">Welcome to v2 👋</h2>
        <p>
          👈 You can explore a document's editing history by picking up one of
          the list 😉.
        </p>
        <PersonalFile />
      </div>
    </div>
  );
};
