import { AutomergeUrl } from '@automerge/automerge-repo';
import { default as Automerge, view } from '@automerge/automerge/next';
import React, { useCallback, useEffect } from 'react';
import { Commit, CommitLog } from './CommitLog';

import { useDocument } from '@automerge/automerge-repo-react-hooks';
import { decodeChange, getAllChanges } from '@automerge/automerge/next';
import { Link } from '../../components/actions/Link';
import { isCommit } from './isCommit';
import { useNavigate } from 'react-router-dom';

interface Document {
  doc: Automerge.Doc<string>;
}

export const ViewHistory = ({ documentId }: { documentId: AutomergeUrl }) => {
  const [document] = useDocument<Document>(documentId as AutomergeUrl);
  const [docValue, setDocValue] = React.useState<string>('');
  const [selectedCommit, setSelectedCommit] = React.useState<string>();
  const [commits, setCommits] = React.useState<Array<Commit>>([]);
  const navigate = useNavigate();

  const selectCommit = useCallback(
    (hash: string) => {
      if (document) {
        const docView = view(document, [hash]);
        setDocValue(docView.doc);
        setSelectedCommit(hash);
      }
    },
    [document]
  );

  useEffect(() => {
    if (document) {
      setDocValue(document.doc || '');
    }
  }, [document]);

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
      setCommits(sortedByRecency);
      const [lastCommit] = sortedByRecency;
      if (lastCommit) {
        selectCommit(lastCommit.hash);
      }
    }
  }, [document, selectCommit]);

  const handleCommitClick = (hash: string) => {
    selectCommit(hash);
  };

  return (
    <div className="flex-auto flex">
      <div className="h-full w-2/5 grow-0">
        {commits.length === 0 ? (
          <div
            className="bg-orange-100 border-l-4 border-orange-500 text-orange-700 p-4"
            role="alert"
          >
            <p className="font-bold">No commits 🧐</p>
            <p className="text-left">
              We couldn't find any commits on this document.
            </p>
            <p className="mt-2">
              <Link to={`/edit/${documentId}`}>Commit on Editor</Link>
            </p>
          </div>
        ) : (
          <CommitLog
            commits={commits}
            onClick={handleCommitClick}
            selectedCommit={selectedCommit}
          />
        )}
      </div>
      <div className="h-full w-full grow">
        <textarea
          onFocus={(e) => {
            return navigate(`/edit/${documentId}`);
          }}
          id="message"
          value={docValue}
          rows={4}
          className="focus:shadow-inner h-full w-full resize-none p-5 rounded-sm border-none outline-none border-gray-400"
        />
      </div>
    </div>
  );
};
