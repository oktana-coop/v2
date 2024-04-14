import { useEffect, useState } from 'react';
import { Link } from '../../components/actions/Link';

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
    <div>
      <h1>Welcome to v2 👋</h1>
      <div>
        {docIds.map((docId) => (
          <div key={docId}>
            <Link to={`/history/${docId}`}>{docId}</Link>
          </div>
        ))}
      </div>
    </div>
  );
};
