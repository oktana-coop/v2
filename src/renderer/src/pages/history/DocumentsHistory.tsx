import React, { useCallback, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { SelectedFileContext } from '../../../../modules/editor-state';
import { ProseMirrorProvider } from '../../../../modules/rich-text/react/context';
import {
  type Commit,
  type VersionControlId,
  type VersionedDocument,
} from '../../../../modules/version-control';
import {
  getDiff,
  getDocumentHandleHistory,
  UncommitedChange,
  VersionedDocumentHandle,
} from '../../../../modules/version-control/models/document';
import { VersionControlContext } from '../../../../modules/version-control/react';
import { CommitHistoryIcon } from '../../components/icons';
import { SidebarHeading } from '../../components/sidebar/SidebarHeading';
import { ChangeLog } from './ChangeLog';
import { type DiffViewProps, ReadOnlyView } from './ReadOnlyView';

export const DocumentsHistory = ({
  documentId,
}: {
  documentId: VersionControlId;
}) => {
  const { versionedDocumentHandle } = useContext(SelectedFileContext);
  const { getDocumentHandleAtCommit } = useContext(VersionControlContext);
  const [selectedCommitHash, setSelectedCommitHash] =
    React.useState<Commit['hash']>();
  const [doc, setDoc] = React.useState<VersionedDocument | null>();
  const [diffProps, setDiffProps] = useState<DiffViewProps | null>(null);
  const [commits, setCommits] = React.useState<
    Array<UncommitedChange | Commit>
  >([]);
  const navigate = useNavigate();
  const [versionedDocument, setVersionedDocument] =
    useState<VersionedDocument | null>(null);

  const selectCommit = useCallback(
    async (hash: string) => {
      setSelectedCommitHash(hash);

      if (versionedDocumentHandle && commits.length > 0) {
        const currentCommitIndex = commits.findIndex(
          (commit) => commit.hash === hash
        );

        // If it's the first commit, there is no diff;
        // We just get the corresponding doc handle.
        // The first element of the commits array is the current one.
        if (currentCommitIndex === commits.length - 1) {
          const currentCommitDocHandle = await getDocumentHandleAtCommit({
            documentHandle: versionedDocumentHandle,
            heads: commits[currentCommitIndex].heads,
          });
          const currentCommitDoc = await currentCommitDocHandle.doc();

          setDiffProps(null);
          setDoc(currentCommitDoc);
        } else {
          // In this case, we get the previous & current commits and their diff
          const previousCommitIndex = currentCommitIndex + 1;

          const currentCommitDocHandle = await getDocumentHandleAtCommit({
            documentHandle: versionedDocumentHandle,
            heads: commits[currentCommitIndex].heads,
          });
          const currentCommitDoc = await currentCommitDocHandle.doc();
          const previousCommitDocHandle = await getDocumentHandleAtCommit({
            documentHandle: versionedDocumentHandle,
            heads: commits[previousCommitIndex].heads,
          });
          const previousCommitDoc = await previousCommitDocHandle.doc();
          const diffPatches = await getDiff(
            currentCommitDocHandle,
            commits[previousCommitIndex].hash,
            commits[currentCommitIndex].hash
          );

          if (previousCommitDoc && currentCommitDoc && diffPatches) {
            setDiffProps({
              docBefore: previousCommitDoc,
              docAfter: currentCommitDoc,
            });
          }

          setDoc(currentCommitDoc);
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
    const loadDocument = async (docHandle: VersionedDocumentHandle) => {
      const versionedDocument = await docHandle.doc();
      if (versionedDocument) {
        document.title = `v2 | "${versionedDocument.title}" version history`;
        setVersionedDocument(versionedDocument);
      }
    };

    if (versionedDocumentHandle) {
      loadDocument(versionedDocumentHandle);
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
        {doc ? (
          <div onDoubleClick={() => navigate(`/edit/${documentId}`)}>
            <ProseMirrorProvider>
              {diffProps ? (
                <ReadOnlyView {...diffProps} />
              ) : (
                <ReadOnlyView doc={doc} />
              )}
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
