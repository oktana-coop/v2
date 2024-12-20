import React, { useCallback, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { SelectedFileContext } from '../../../../modules/editor-state';
import { ProseMirrorProvider } from '../../../../modules/rich-text/react/context';
import {
  type Commit,
  type DecodedChange,
  getCommitsAndUncommittedChanges,
  type VersionControlId,
  type VersionedDocument,
  VersionedDocumentHandle,
} from '../../../../modules/version-control';
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
  const [tmpDocHandle, setTmpDocHandle] =
    React.useState<VersionedDocumentHandle | null>();
  const [commits, setCommits] = React.useState<Array<DecodedChange | Commit>>(
    []
  );
  const navigate = useNavigate();
  const [versionedDocument, setVersionedDocument] =
    useState<VersionedDocument | null>(null);

  useEffect(() => {
    if (versionedDocumentHandle) {
      const versionedDocument = versionedDocumentHandle.docSync();
      if (versionedDocument) {
        document.title = `v2 | "${versionedDocument.title}" version history`;
        setVersionedDocument(versionedDocument);
      }
    }
  }, [versionedDocumentHandle]);

  const selectCommit = useCallback(
    async (hash: string) => {
      if (versionedDocument) {
        setSelectedCommit(hash);
        const tmpHandle = await getDocumentAt({
          document: versionedDocument,
          commit: hash,
        });
        // ⚠️ CAUTION: This (tmpHandle) needs to be deleted
        // as soon as it's not needed
        setTmpDocHandle(tmpHandle);
      }
    },
    [getDocumentAt, versionedDocument]
  );

  useEffect(() => {
    if (versionedDocument) {
      const commitsAndUncommittedChanges =
        getCommitsAndUncommittedChanges(versionedDocument);

      setCommits(commitsAndUncommittedChanges);
      const [lastChange] = commitsAndUncommittedChanges;
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
        {tmpDocHandle ? (
          <div onDoubleClick={() => navigate(`/edit/${documentId}`)}>
            <ProseMirrorProvider>
              <RichTextEditor
                // explicitly define onSave as a no-op
                onSave={() => {}}
                docHandle={tmpDocHandle}
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
