import './App.css';
import React, { useEffect } from 'react';
import { default as A } from '@automerge/automerge/next';
import { AutomergeUrl } from '@automerge/automerge-repo';
import { useDocument } from '@automerge/automerge-repo-react-hooks';

interface Document {
  doc: A.Doc<string>;
}

function App({ docUrl }: { docUrl: AutomergeUrl }) {
  const [value, changeValue] = React.useState<string>('');
  const [document, changeDocument] = useDocument<Document>(docUrl);

  useEffect(() => {
    if (document) {
      changeValue(document.doc || '');
    }
  }, [document]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    changeValue(e.target.value);
  };

  const handleBlur = () => {
    changeDocument((doc) => {
      doc.doc = value;
    });
  };

  return (
    <textarea
      id="message"
      value={value}
      rows={4}
      className="block p-2.5 w-96 h-80 text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
      placeholder="Write your thoughts here..."
      onChange={handleChange}
      onBlur={handleBlur}
    />
  );
}

export default App;
