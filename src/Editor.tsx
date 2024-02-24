import React, { useEffect } from 'react';
import { useDocument } from '@automerge/automerge-repo-react-hooks';
import { AutomergeUrl } from '@automerge/automerge-repo';
import {
  default as Automerge,
  decodeChange,
  getAllChanges,
  view,
} from '@automerge/automerge/next';

interface Document {
  doc: Automerge.Doc<string>;
}

export function Editor({ docUrl }: { docUrl: AutomergeUrl }) {
  const [value, changeValue] = React.useState<string>('');
  const [document, changeDocument] = useDocument<Document>(docUrl);
  const [hashes, setHashes] = React.useState<Array<string>>([]);

  useEffect(() => {
    if (document) {
      changeValue(document.doc || '');

      const changes = getAllChanges(document);
      const decodedChanges = changes.map((change) => decodeChange(change));
      console.log('decodedChanges 👉', decodedChanges);
      const hashes = decodedChanges.map((change) => change.hash);
      setHashes(hashes);
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

  const onSave = () => {
    const commitMessage = prompt('Save your changes with a message..');
    console.log('commitMessage 👉', commitMessage);

    changeDocument((doc) => {
      doc.doc = value;
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // cmd/ctrl + s
    if (e.metaKey && e.key === 's') {
      e.preventDefault();
      onSave();
    }
  };

  const handleHashClick = (hash: string) => {
    if (document) {
      const docView = view(document, [hash]);
      console.log(docView.doc);
    }
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
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
      />
      <div className="flex-auto w-32 p-5 h-full break-words text-black bg-white">
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
}
