import React, { useCallback, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  type Commit,
  type DecodedChange,
  getCommitsAndUncommittedChanges,
  getDocumentAtCommit,
  isValidVersionControlId,
  type VersionControlId,
  type VersionedDocument,
  type VersionedDocumentHandle,
} from '../../../../modules/version-control';
import { VersionControlContext } from '../../../../modules/version-control/repo/browser';
import { RichTextEditor } from '../../components/editing/RichTextEditor';
import { CommitHistoryIcon } from '../../components/icons';
import { SidebarHeading } from '../../components/sidebar/SidebarHeading';
import { ChangeLog } from './ChangeLog';

export const DocumentsHistory = ({
  documentId,
}: {
  documentId: VersionControlId;
}) => {
  const [selectedCommit, setSelectedCommit] = React.useState<string>();
  const [commits, setCommits] = React.useState<Array<DecodedChange | Commit>>(
    []
  );
  const navigate = useNavigate();
  const [versionedDocumentHandle, setVersionedDocumentHandle] =
    useState<VersionedDocumentHandle | null>(null);
  const [versionedDocument, setVersionedDocument] =
    useState<VersionedDocument | null>(null);
  const { findDocument } = useContext(VersionControlContext);

  useEffect(() => {
    const findVersionedDocument = async () => {
      if (!documentId) {
        return;
      }

      if (isValidVersionControlId(documentId)) {
        const documentHandle = await findDocument(documentId);
        setVersionedDocumentHandle(documentHandle);
      } else {
        setVersionedDocumentHandle(null);
      }
    };

    findVersionedDocument();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

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
    (hash: string) => {
      if (versionedDocument) {
        const docView = getDocumentAtCommit(versionedDocument)(hash);
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
        {versionedDocumentHandle ? (
          <div onDoubleClick={() => navigate(`/edit/${documentId}`)}>
            <RichTextEditor
              // explicitly define onSave as a no-op
              onSave={() => {}}
              docHandle={versionedDocumentHandle}
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
