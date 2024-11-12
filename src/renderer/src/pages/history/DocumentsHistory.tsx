import { next as Automerge } from '@automerge/automerge/slim';
import React, { useCallback, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  type Commit,
  type DocHandle,
  isCommit,
  isValidVersionControlId,
  type RichTextDocument,
  type VersionControlId,
} from '../../../../modules/version-control';
import {
  useDocument,
  VersionControlContext,
} from '../../../../modules/version-control/repo/browser';
import { RichTextEditor } from '../../components/editing/RichTextEditor';
import { CommitHistoryIcon } from '../../components/icons';
import { SidebarHeading } from '../../components/sidebar/SidebarHeading';
import { ChangeLog } from './ChangeLog';

export const DocumentsHistory = ({
  documentId,
}: {
  documentId: VersionControlId;
}) => {
  const [versionedDocument] = useDocument<RichTextDocument>(documentId);
  const [selectedCommit, setSelectedCommit] = React.useState<string>();
  const [commits, setCommits] = React.useState<
    Array<Automerge.DecodedChange | Commit>
  >([]);
  const navigate = useNavigate();
  const [automergeHandle, setAutomergeHandle] =
    useState<DocHandle<RichTextDocument> | null>(null);
  const { repo } = useContext(VersionControlContext);

  useEffect(() => {
    if (!documentId || !repo) {
      return;
    }

    if (isValidVersionControlId(documentId)) {
      const automergeHandle = repo.find<RichTextDocument>(documentId);
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
      const allChanges = Automerge.getAllChanges(versionedDocument);
      const decodedChanges = allChanges.map(Automerge.decodeChange);
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
            <RichTextEditor
              // explicitly define onSave as a no-op
              onSave={() => {}}
              docHandle={automergeHandle}
              isEditable={false}
            />
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
