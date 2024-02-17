import { AutomergeUrl } from '@automerge/automerge-repo';
import { useDocument } from '@automerge/automerge-repo-react-hooks';
import {
  default as A,
  Change,
  DecodedChange,
  decodeChange,
  getAllChanges,
  view,
} from '@automerge/automerge/next';
import { useEffect, useState } from 'react';
import '../App.css';

interface Document {
  doc: A.Doc<string>;
}

export const Editor = ({ docUrl }: { docUrl: AutomergeUrl }) => {
  const [document, changeDocument] = useDocument<Document>(docUrl);
  const [hashes, setHashes] = useState<Array<string>>([]);

  useEffect(() => {
    if (document) {
      const changes = getAllChanges(document);
      const decodedChanges = changes.map(
        (change: Change) => decodeChange(change) as DecodedChange
      );
      const hashes = decodedChanges.map((change) => change.hash as string);
      setHashes(hashes);
    }
  }, [document]);

  const handleHashClick = (hash: string) => {
    if (document) {
      const docView = view(document, [hash]);
      console.log(docView.doc);
    }
  };

  return (
    <div className="flex h-dvh">
      <textarea
        id="message"
        autoFocus={true}
        value={document && document.doc}
        rows={4}
        className="block p-2.5 w-96 h-full text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500 flex-auto"
        placeholder="Write your thoughts here..."
        onChange={(e) =>
          changeDocument((document) => (document.doc = e.target.value))
        }
      />
      <div className="flex-auto w-32 p-5 break-words">
        <div>
          <h1>History</h1>
          {hashes.map((hash) => (
            <div key={hash} onClick={() => handleHashClick(hash)}>
              {hash}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
