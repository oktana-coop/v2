import '../App.css';
import { useState, useEffect } from 'react';
import {
  Heads,
  getHeads,
  getHistory,
  default as A,
} from '@automerge/automerge/next';
import { AutomergeUrl } from '@automerge/automerge-repo';
import { useDocument } from '@automerge/automerge-repo-react-hooks';

interface Document {
  doc: A.Doc<string>;
}

export const Editor = ({ docUrl }: { docUrl: AutomergeUrl }) => {
  const [document, changeDocument] = useDocument<Document>(docUrl);
  const [heads, setHeads] = useState<Heads>();

  useEffect(() => {
    if (document) {
      console.log('document 👉', document);
      const history = getHistory(document);
      console.log('history 👉', history);
    }
  }, [document]);

  useEffect(() => {
    if (document) {
      const heads = getHeads(document);
      setHeads(heads);
    }
  }, [document]);

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
          <h1>Heads</h1>
          {heads && heads.map((head) => <div key={head}>{head}</div>)}
        </div>
        <div>
          <h1>History</h1>
          {heads && heads.map((head) => <div key={head}>{head}</div>)}
        </div>
      </div>
    </div>
  );
};
