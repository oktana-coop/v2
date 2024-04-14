import { AutomergeUrl } from '@automerge/automerge-repo';
import { default as Automerge, view } from '@automerge/automerge/next';
import React, { useCallback, useEffect } from 'react';
import { repo } from '../../automerge';
import { Commit, CommitLog } from './CommitLog';

import { isValidAutomergeUrl } from '@automerge/automerge-repo';
import { useDocument } from '@automerge/automerge-repo-react-hooks';
import { decodeChange, getAllChanges } from '@automerge/automerge/next';
import { useParams } from 'react-router-dom';
import { isCommit } from './isCommit';

interface Document {
  doc: Automerge.Doc<string>;
}

export const History = () => {
  const { documentId } = useParams();
  const [document] = useDocument<Document>(documentId as AutomergeUrl);
  const [docValue, setDocValue] = React.useState<string>('');
  const [selectedCommit, setSelectedCommit] = React.useState<string>();
  const [commits, setCommits] = React.useState<Array<Commit>>([]);

  useEffect(() => {
    if (isValidAutomergeUrl(documentId)) {
      const handle = repo.find(documentId);
      console.log('found doc handle 👉', handle);
    } else {
      console.log('Invalid automerge URL 💥');
    }
  }, [documentId]);

  const selectCommit = useCallback(
    (hash: string) => {
      if (document) {
        const docView = view(document, [hash]);
        setSelectedCommit(hash);
        setDocValue(docView.doc);
      }
    },
    [document]
  );

  const handleCommitClick = (hash: string) => {
    selectCommit(hash);
  };

  useEffect(() => {
    if (document) {
      const changes = getAllChanges(document);
      const decodedChanges = changes.map((change) => decodeChange(change));
      const commits = decodedChanges.filter(isCommit).map((change) => ({
        hash: change.hash,
        message: change.message,
        time: new Date(change.time),
      }));
      const sortedByRecency = commits.sort(
        (a, b) => b.time.getTime() - a.time.getTime()
      );
      const [lastCommit] = sortedByRecency;
      setCommits(sortedByRecency);
      selectCommit(lastCommit.hash);
    }
  }, [document, selectCommit]);

  return (
    <>
      <div className="flex-auto flex">
        <div className="h-full w-2/5 grow-0">
          <CommitLog
            commits={commits}
            onClick={handleCommitClick}
            selectedCommit={selectedCommit}
          />
        </div>
        <div className="h-full w-full grow">
          <textarea
            id="message"
            value={docValue}
            disabled={true}
            rows={4}
            className="focus:shadow-inner h-full w-full resize-none p-5 rounded-sm border-none outline-none border-gray-400"
          />
        </div>
      </div>
    </>
  );
};
