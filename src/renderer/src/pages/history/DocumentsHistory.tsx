import React, { useCallback, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { SelectedFileContext } from '../../../../modules/editor-state';
import { ProseMirrorProvider } from '../../../../modules/rich-text/react/context';
import {
  type Commit,
  type VersionControlId,
  type VersionedDocument,
  type VersionedDocumentHandle,
} from '../../../../modules/version-control';
import {
  getDiff,
  getDocumentHandleHistory,
  UncommitedChange,
  VersionedDocumentPatch,
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
  const { getDocumentHandleAtCommit, getWriteableHandleAtCommit } = useContext(
    VersionControlContext
  );
  const [selectedCommitHash, setSelectedCommitHash] =
    React.useState<Commit['hash']>();
  const [previousCommitDocHandle, setPreviousCommitDocHandle] =
    React.useState<VersionedDocumentHandle | null>();
  const [diffPatches, setDiffPatches] =
    React.useState<Array<VersionedDocumentPatch> | null>();
  const [currentCommitDoc, setCurrentCommitDoc] =
    React.useState<VersionedDocument | null>();
  const [commits, setCommits] = React.useState<
    Array<UncommitedChange | Commit>
  >([]);
  const navigate = useNavigate();
  const [versionedDocument, setVersionedDocument] =
    useState<VersionedDocument | null>(null);

  const selectCommit = useCallback(
    async (hash: string) => {
      setSelectedCommitHash(hash);
      if (versionedDocumentHandle) {
        const currentCommitIndex = commits.findIndex(
          (commit) => commit.hash === hash
        );
        const previousCommitIndex = currentCommitIndex + 1;
        const currentCommit = commits[currentCommitIndex];
        const previousCommit = commits[previousCommitIndex];
        if (currentCommit && previousCommit) {
          const currentCommitDocHandle = await getDocumentHandleAtCommit({
            documentHandle: versionedDocumentHandle,
            heads: currentCommit.heads,
          });
          const currentCommitDoc = await currentCommitDocHandle.doc();
          const previousCommitDocHandle = await getWriteableHandleAtCommit({
            documentHandle: versionedDocumentHandle,
            heads: previousCommit.heads,
          });

          const diffPatches = await getDiff(
            previousCommitDocHandle,
            previousCommit.hash,
            currentCommit.hash
          );

          setDiffPatches(diffPatches);
          setCurrentCommitDoc(currentCommitDoc);
          setPreviousCommitDocHandle(previousCommitDocHandle);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [versionedDocument, getDocumentHandleAtCommit]
  );

  useEffect(() => {
    if (versionedDocumentHandle) {
      const commits = getDocumentHandleHistory(versionedDocumentHandle);
      setCommits(commits);
      const [lastChange] = commits;
      if (lastChange) selectCommit(lastChange.hash);
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
          selectedCommit={selectedCommitHash}
        />
      </div>
      <div className="flex w-full grow items-stretch">
        {previousCommitDocHandle && diffPatches ? (
          <div onDoubleClick={() => navigate(`/edit/${documentId}`)}>
            <ProseMirrorProvider>
              <RichTextEditor
                // explicitly define onSave as a no-op
                onSave={() => {}}
                docHandle={previousCommitDocHandle}
                isEditable={false}
                diffProps={{
                  patches: diffPatches,
                  docAfter: currentCommitDoc!,
                }}
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
