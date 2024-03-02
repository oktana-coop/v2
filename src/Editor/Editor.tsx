import React, { useEffect } from 'react';
import { useDocument } from '@automerge/automerge-repo-react-hooks';
import { AutomergeUrl } from '@automerge/automerge-repo';
import {
  default as Automerge,
  decodeChange,
  getAllChanges,
  view,
} from '@automerge/automerge/next';
import { EditingHistory, Commit } from './EditingHistory';
import { useSearchParams } from 'react-router-dom';

interface Document {
  doc: Automerge.Doc<string>;
}

const isCommit = (change: Automerge.Change) => {
  // we make the rules!
  return change.message && change.time;
};

export function Editor({ docUrl }: { docUrl: AutomergeUrl }) {
  const [value, changeValue] = React.useState<string>('');
  const [document, changeDocument] = useDocument<Document>(docUrl);
  const [, setSearchParams] = useSearchParams();

  // HACK: This is a temporary solution to get an existing document from the URL
  useEffect(() => {
    setSearchParams({ docUrl });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    // temporary solution until we decide on a better way to handle user input for commiting changes
    const commitMessage = prompt('Save your changes with a message...') || '';
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
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      commitChanges();
    }
  };

  const handleCommitClick = (hash: string) => {
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
      {
        // This can temporarily live here, until we move it to the sidebar
        // possibly
      }
      <EditingHistory commits={commits} onClick={handleCommitClick} />
    </div>
  );
}
