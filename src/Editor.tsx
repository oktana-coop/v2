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

type Commit = {
  hash: string;
  message: string;
  time: Date;
};

const isCommit = (change: Automerge.Change) => {
  // we make the rules!
  return change.message && change.time;
};

export function Editor({ docUrl }: { docUrl: AutomergeUrl }) {
  const [value, changeValue] = React.useState<string>('');
  const [document, changeDocument] = useDocument<Document>(docUrl);
  const [commits, setCommits] = React.useState<Array<Commit>>([]);

  useEffect(() => {
    if (document) {
      changeValue(document.doc || '');

      const changes = getAllChanges(document);
      const decodedChanges = changes.map((change) => decodeChange(change));
      const commits = decodedChanges.filter(isCommit).map((change) => ({
        hash: change.hash,
        message: change.message,
        time: new Date(change.time),
      }));
      setCommits(commits);
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

  const commitChanges = () => {
    const commitMessage = prompt('Save your changes with a message..') || '';
    const message = commitMessage?.trim();

    changeDocument(
      (doc) => {
        doc.doc = value;
      },
      {
        message: message,
        time: new Date().getTime(),
      }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // cmd/ctrl + s
    if (e.metaKey && e.key === 's') {
      e.preventDefault();
      commitChanges();
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
          <h1>Change history</h1>
          {commits.map((commit) => (
            <div key={commit.hash} onClick={() => handleHashClick(commit.hash)}>
              {commit.message}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
