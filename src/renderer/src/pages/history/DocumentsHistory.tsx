import * as Automerge from '@automerge/automerge/next';
import { decodeChange, getAllChanges } from '@automerge/automerge/next';
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { RichTextEditor } from '../../components/editing/RichTextEditor';
import { CommitHistoryIcon } from '../../components/icons';
import { SidebarHeading } from '../../components/sidebar/SidebarHeading';
import {
  AutomergeUrl,
  type Commit,
  DocHandle,
  isCommit,
  isValidAutomergeUrl,
  useDocument,
  useRepo,
  VersionedDocument,
} from '../../modules/version-control';
import { ChangeLog } from './ChangeLog';

export const DocumentsHistory = ({
  documentId,
}: {
  documentId: AutomergeUrl;
}) => {
  const [versionedDocument] = useDocument<VersionedDocument>(documentId);
  const [selectedCommit, setSelectedCommit] = React.useState<string>();
  const [commits, setCommits] = React.useState<
    Array<Automerge.DecodedChange | Commit>
  >([]);
  const navigate = useNavigate();
  const [automergeHandle, setAutomergeHandle] =
    useState<DocHandle<VersionedDocument> | null>(null);
  const repo = useRepo();

  useEffect(() => {
    if (!documentId) {
      return;
    }

    if (isValidAutomergeUrl(documentId)) {
      const automergeHandle = repo.find<VersionedDocument>(documentId);
      automergeHandle.whenReady().then(() => {
        setAutomergeHandle(automergeHandle);
      });
    } else {
      setAutomergeHandle(null);
    }
  }, [documentId, repo]);

  useEffect(() => {
    if (versionedDocument) {
      document.title = `v2 | "${versionedDocument.title}" version history`;
    }
  }, [versionedDocument]);

  const selectCommit = useCallback(
    (hash: string) => {
      if (versionedDocument) {
        const docView = Automerge.view(versionedDocument, [hash]);
        // TODO: support rendering a rich text version of the document
        // at a given point in time
        console.info(
          `This is the plain document at this point in time 👉

${docView.content}

the rich-text version is not yet supported.`
        );
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
    <div className="flex flex-auto items-stretch">
      <div className="w-2/5 grow-0 break-words border-r border-gray-300 p-5 dark:border-neutral-600">
        <SidebarHeading icon={CommitHistoryIcon} text="Version History" />
        <ChangeLog
          changes={commits}
          onClick={handleCommitClick}
          selectedCommit={selectedCommit}
        />
      </div>
      <div className="flex w-full grow items-stretch">
        {automergeHandle ? (
          <div onDoubleClick={() => navigate(`/edit/${documentId}`)}>
            <RichTextEditor docHandle={automergeHandle} isEditable={false} />
          </div>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-center">
            Loading...
          </div>
        )}
      </div>
    </div>
  );
};
