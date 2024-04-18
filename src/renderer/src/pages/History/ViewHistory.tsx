import { AutomergeUrl } from '@automerge/automerge-repo';
import { view } from '@automerge/automerge/next';
import React, { useCallback, useEffect } from 'react';
import { Commit, CommitLog } from './CommitLog';

import { useDocument } from '@automerge/automerge-repo-react-hooks';
import { decodeChange, getAllChanges } from '@automerge/automerge/next';
import { Link } from '../../components/actions/Link';
import { isCommit } from './isCommit';
import { useNavigate } from 'react-router-dom';
import { VersionedDocument } from '../../automerge';

export const ViewHistory = ({ documentId }: { documentId: AutomergeUrl }) => {
  const [versionedDocument] = useDocument<VersionedDocument>(documentId);
  const [docValue, setDocValue] = React.useState<string>('');
  const [selectedCommit, setSelectedCommit] = React.useState<string>();
  const [commits, setCommits] = React.useState<Array<Commit>>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (versionedDocument) {
      document.title = `v2 | "${versionedDocument.title}" version history`;
      setDocValue(versionedDocument.content || '');
    }
  }, [versionedDocument]);

  const selectCommit = useCallback(
    (hash: string) => {
      if (versionedDocument) {
        const docView = view(versionedDocument, [hash]);
        setDocValue(docView.content);
        setSelectedCommit(hash);
      }
    },
    [versionedDocument]
  );

  useEffect(() => {
    if (versionedDocument) {
      const changes = getAllChanges(versionedDocument);
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
  }, [versionedDocument, selectCommit]);

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
          id="message"
          value={docValue}
          readOnly={true}
          onDoubleClick={() => navigate(`/edit/${documentId}`)}
          onKeyDown={() => navigate(`/edit/${documentId}`)}
          rows={4}
          className="focus:shadow-inner h-full w-full resize-none p-5 rounded-sm border-none outline-none border-gray-400"
        />
      </div>
    </div>
  );
};
