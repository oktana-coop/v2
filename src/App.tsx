import './App.css';
import './App.css';
import { Sidebar } from './Sidebar';
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
    <div className="flex flex-row h-full">
      <Sidebar />
      <div className="flex items-center justify-center w-full m-2">
        <textarea
          id="message"
          value={value}
          rows={4}
          className="w-3/5 h-full resize-none p-5 text-black bg-white rounded-md border-none outline-none border-gray-400"
          autoFocus
          onChange={handleChange}
          onBlur={handleBlur}
        />
      </div>
    </div>
  );
}

export default App;
