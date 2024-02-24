import React, { useEffect } from 'react';
import { useDocument } from '@automerge/automerge-repo-react-hooks';
import { AutomergeUrl } from '@automerge/automerge-repo';
import { default as Automerge } from '@automerge/automerge/next';

interface Document {
  doc: Automerge.Doc<string>;
}

export function Editor({ docUrl }: { docUrl: AutomergeUrl }) {
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
    <div className="flex items-center justify-center w-full m-2">
      <textarea
        id="message"
        value={value}
        rows={4}
        className="focus:shadow-inner w-3/5 h-full resize-none p-5 text-black bg-white rounded-md border-none outline-none border-gray-400"
        autoFocus
        onChange={handleChange}
        onBlur={handleBlur}
      />
    </div>
  );
}
