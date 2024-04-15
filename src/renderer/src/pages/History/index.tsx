import { useEffect, useState } from 'react';
import { Link } from '../../components/actions/Link';
import { PersonalFile } from '../../components/illustrations/PersonalFile';

export const HistoryIndex = () => {
  const [docIds, setDocIds] = useState<Array<string>>([]);

  useEffect(() => {
    const docUrls = localStorage.getItem('docUrls');
    if (docUrls) {
      const docs = JSON.parse(docUrls);
      setDocIds(Object.keys(docs));
    }
  }, []);

  return (
    <div className="flex-auto flex">
      <div className="h-full w-2/5 grow-0 p-5 overflow-y-scroll ">
        <h2>Your docs</h2>
        {docIds.map((docId) => (
          <div className="text-left" key={docId}>
            <Link to={`/history/${docId}`}>{docId}</Link>
          </div>
        ))}
      </div>
      <div className="h-full w-full grow flex flex-col items-center justify-center">
        <h2 className="text-2xl">Welcome to v2 👋</h2>
        <p className="text-gray-500">
          👈 You can explore a documents' editing history by picking up one of
          the list 😉
        </p>
        <PersonalFile />
      </div>
    </div>
  );
};
