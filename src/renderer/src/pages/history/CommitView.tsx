import * as Automerge from '@automerge/automerge/next';
import { decodeChange, getAllChanges } from '@automerge/automerge/next';
import React, { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  AutomergeUrl,
  type Commit,
  isCommit,
  useDocument,
  VersionedDocument,
} from '../../../../modules/version-control';
import { CommitHistoryIcon } from '../../components/icons';
import { SidebarHeading } from '../../components/sidebar/SidebarHeading';
import { ChangeLog } from './ChangeLog';

export const CommitView = ({ documentId }: { documentId: AutomergeUrl }) => {
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
        const docView = Automerge.view(versionedDocument, [hash]);
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
    <div className="flex flex-auto">
      <div className="h-full w-2/5 grow-0 overflow-y-auto border-r border-gray-300 p-5 dark:border-neutral-600">
        <div className="h-full flex-auto break-words">
          <SidebarHeading icon={CommitHistoryIcon} text="Version History" />
          <ChangeLog
            changes={commits}
            onClick={handleCommitClick}
            selectedCommit={selectedCommit}
          />
        </div>
      </div>
      <div className="h-full w-full grow">
        <textarea
          id="message"
          value={docValue}
          readOnly={true}
          onDoubleClick={() => navigate(`/edit/${documentId}`)}
          onKeyDown={() => navigate(`/edit/${documentId}`)}
          rows={4}
          className="h-full w-full resize-none bg-inherit p-5 outline-none focus:shadow-inner"
        />
      </div>
    </div>
  );
};
