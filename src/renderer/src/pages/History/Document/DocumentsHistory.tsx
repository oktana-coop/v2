import { AutomergeUrl } from '@automerge/automerge-repo';
import { default as Automerge, view } from '@automerge/automerge/next';
import React, { useCallback, useEffect } from 'react';
import { ChangeLog } from './ChangeLog';
import type { Commit } from '../../../automerge';

import { useDocument } from '@automerge/automerge-repo-react-hooks';
import { decodeChange, getAllChanges } from '@automerge/automerge/next';
import { useNavigate } from 'react-router-dom';
import { VersionedDocument, isCommit } from '../../../automerge';
import { CommitHistoryIcon } from '../../../components/icons';
import { SidebarHeading } from '../../../components/sidebar/SidebarHeading';

export const DocumentsHistory = ({
  documentId,
}: {
  documentId: AutomergeUrl;
}) => {
  const [versionedDocument] = useDocument<VersionedDocument>(documentId);
  const [docValue, setDocValue] = React.useState<string>('');
  const [selectedCommit, setSelectedCommit] = React.useState<string>();
  const [commits, setCommits] = React.useState<
    Array<Automerge.DecodedChange | Commit>
  >([]);
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
      const allChanges = getAllChanges(versionedDocument);
      const decodedChanges = allChanges.map(decodeChange);
      const [latestChange] = decodedChanges.slice(-1);
      const commits = decodedChanges.filter(isCommit).map((change) => ({
        hash: change.hash,
        message: change.message,
        time: new Date(change.time),
      })) as Array<Commit>;
      const orderedCommits = commits.reverse();
      const [lastCommit] = orderedCommits;
      const changes =
        latestChange?.hash !== lastCommit?.hash
          ? [latestChange, ...orderedCommits]
          : orderedCommits;
      setCommits(changes);
      const [lastChange] = changes;
      if (lastChange) selectCommit(lastChange.hash);
    }
  }, [versionedDocument, selectCommit]);

  const handleCommitClick = (hash: string) => {
    selectCommit(hash);
  };

  return (
    <div className="flex-auto flex items-stretch">
      <div className="w-2/5 grow-0 border-r border-gray-300 dark:border-neutral-600 p-5 break-words">
        <SidebarHeading icon={CommitHistoryIcon} text="Version History" />
        <ChangeLog
          changes={commits}
          onClick={handleCommitClick}
          selectedCommit={selectedCommit}
        />
      </div>
      <div className="w-full grow flex items-stretch">
        <textarea
          id="message"
          value={docValue}
          readOnly={true}
          onDoubleClick={() => navigate(`/edit/${documentId}`)}
          onKeyDown={() => navigate(`/edit/${documentId}`)}
          rows={4}
          className="bg-inherit focus:shadow-inner w-full resize-none p-5 outline-none"
        />
      </div>
    </div>
  );
};
