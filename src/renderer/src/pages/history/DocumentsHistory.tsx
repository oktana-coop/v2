import React, { useCallback, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { SelectedFileContext } from '../../../../modules/editor-state';
import { ProseMirrorProvider } from '../../../../modules/rich-text/react/context';
import {
  type Commit,
  type VersionControlId,
  type VersionedDocument,
  VersionedDocumentHandle,
} from '../../../../modules/version-control';
import {
  getDocumentHandleAtCommit,
  getDocumentHandleHistory,
  UncommitedChange,
} from '../../../../modules/version-control/models/document';
import { VersionControlContext } from '../../../../modules/version-control/react';
import { RichTextEditor } from '../../components/editing/RichTextEditor';
import { CommitHistoryIcon } from '../../components/icons';
import { SidebarHeading } from '../../components/sidebar/SidebarHeading';
import { ChangeLog } from './ChangeLog';

export const DocumentsHistory = ({
  documentId,
}: {
  documentId: VersionControlId;
}) => {
  const { versionedDocumentHandle } = useContext(SelectedFileContext);
  const { getDocumentAt } = useContext(VersionControlContext);
  const [selectedCommit, setSelectedCommit] = React.useState<string>();
  const [currentDocHandle, setCurrentDocHandle] =
    React.useState<VersionedDocumentHandle | null>();
  const [commits, setCommits] = React.useState<
    Array<UncommitedChange | Commit>
  >([]);
  const navigate = useNavigate();
  const [versionedDocument, setVersionedDocument] =
    useState<VersionedDocument | null>(null);

  const selectCommit = useCallback(
    async (hash: string) => {
      setSelectedCommit(hash);
      if (versionedDocumentHandle) {
        const commit = commits.find((commit) => commit.hash === hash);
        if (commit) {
          const currentHandle = getDocumentHandleAtCommit(
            versionedDocumentHandle
          )(commit.heads);
          setCurrentDocHandle(currentHandle);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [getDocumentAt, versionedDocument]
  );

  useEffect(() => {
    if (versionedDocumentHandle) {
      const commits = getDocumentHandleHistory(versionedDocumentHandle);
      setCommits(commits);
      // const [lastChange] = commits;
      // if (lastChange) selectCommit(lastChange.hash);
    }
  }, [versionedDocumentHandle, selectCommit]);

  useEffect(() => {
    if (versionedDocumentHandle) {
      const versionedDocument = versionedDocumentHandle.docSync();
      if (versionedDocument) {
        document.title = `v2 | "${versionedDocument.title}" version history`;
        setVersionedDocument(versionedDocument);
      }
    }
  }, [versionedDocumentHandle]);

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
        {currentDocHandle ? (
          <div onDoubleClick={() => navigate(`/edit/${documentId}`)}>
            <ProseMirrorProvider>
              <RichTextEditor
                // explicitly define onSave as a no-op
                onSave={() => {}}
                docHandle={currentDocHandle}
                isEditable={false}
              />
            </ProseMirrorProvider>
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
