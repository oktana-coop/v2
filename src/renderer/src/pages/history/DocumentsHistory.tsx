import React, { useCallback, useContext, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { SelectedFileContext } from '../../../../modules/editor-state';
import { SidebarLayoutContext } from '../../../../modules/editor-state/sidebar-layout/context';
import { ProseMirrorProvider } from '../../../../modules/rich-text/react/context';
import {
  type Commit,
  getDiff,
  getDocumentHandleHistory,
  isCommit,
  type UncommitedChange,
  type VersionControlId,
  type VersionedDocument,
  type VersionedDocumentHandle,
} from '../../../../modules/version-control';
import { VersionControlContext } from '../../../../modules/version-control/react';
import { SidebarLayout } from '../../components/layout/SidebarLayout';
import { ActionsBar } from './ActionsBar';
import { ChangeLogSidebar } from './change-log/Sidebar';
import { type DiffViewProps, ReadOnlyView } from './ReadOnlyView';

export const DocumentsHistory = ({
  documentId,
}: {
  documentId: VersionControlId;
}) => {
  const { changeId } = useParams();
  const { versionedDocumentHandle } = useContext(SelectedFileContext);
  const { getDocumentHandleAtCommit } = useContext(VersionControlContext);
  const { isSidebarOpen, toggleSidebar } = useContext(SidebarLayoutContext);
  const [doc, setDoc] = React.useState<VersionedDocument | null>();
  const [viewTitle, setViewTitle] = useState<string>('');
  const [diffProps, setDiffProps] = useState<DiffViewProps | null>(null);
  const [commits, setCommits] = React.useState<
    Array<UncommitedChange | Commit>
  >([]);
  const navigate = useNavigate();

  const { showDiffInHistoryView, toggleShowDiffInHistoryView } =
    useContext(SelectedFileContext);

  const updateViewTitle = (change: Commit | UncommitedChange) => {
    if (isCommit(change)) {
      setViewTitle(change.message);
    } else {
      setViewTitle('Uncommitted Changes');
    }
  };

  useEffect(() => {
    const loadDocOrDiff = async (
      docHandle: VersionedDocumentHandle,
      commits: (Commit | UncommitedChange)[],
      changeId: Commit['hash']
    ) => {
      const currentCommitIndex = commits.findIndex(
        (commit) => commit.hash === changeId
      );

      // If it's the first commit, there is no diff;
      // We just get the corresponding doc handle.
      // The first element of the commits array is the current one.
      if (currentCommitIndex === commits.length - 1) {
        const currentCommitDocHandle = await getDocumentHandleAtCommit({
          documentHandle: docHandle,
          heads: commits[currentCommitIndex].heads,
        });
        const currentCommitDoc = await currentCommitDocHandle.doc();

        setDiffProps(null);
        setDoc(currentCommitDoc);
        updateViewTitle(commits[currentCommitIndex]);
      } else {
        // In this case, we get the previous & current commits and their diff
        const previousCommitIndex = currentCommitIndex + 1;

        const currentCommitDocHandle = await getDocumentHandleAtCommit({
          documentHandle: docHandle,
          heads: commits[currentCommitIndex].heads,
        });
        const currentCommitDoc = await currentCommitDocHandle.doc();
        const previousCommitDocHandle = await getDocumentHandleAtCommit({
          documentHandle: docHandle,
          heads: commits[previousCommitIndex].heads,
        });
        const previousCommitDoc = await previousCommitDocHandle.doc();
        const diffPatches = await getDiff(
          currentCommitDocHandle,
          commits[previousCommitIndex].hash,
          commits[currentCommitIndex].hash
        );

        if (
          previousCommitDoc &&
          currentCommitDoc &&
          diffPatches &&
          showDiffInHistoryView
        ) {
          setDiffProps({
            docBefore: previousCommitDoc,
            docAfter: currentCommitDoc,
          });
        }

        setDoc(currentCommitDoc);
        updateViewTitle(commits[currentCommitIndex]);
      }
    };

    if (versionedDocumentHandle && commits.length > 0 && changeId) {
      loadDocOrDiff(versionedDocumentHandle, commits, changeId);
    }
  }, [
    changeId,
    getDocumentHandleAtCommit,
    versionedDocumentHandle,
    commits,
    showDiffInHistoryView,
  ]);

  const selectCommit = useCallback(
    (hash: string) => navigate(`/history/${documentId}/${hash}`),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [documentId]
  );

  useEffect(() => {
    const loadHistoryAndSelectCommit = (docHandle: VersionedDocumentHandle) => {
      const commits = getDocumentHandleHistory(docHandle);
      setCommits(commits);

      if (changeId) {
        selectCommit(changeId);
      } else {
        // If no changeId is provided, we select the last commit
        const [lastChange] = commits;
        selectCommit(lastChange.hash);
      }
    };

    if (versionedDocumentHandle) {
      loadHistoryAndSelectCommit(versionedDocumentHandle);
    }
  }, [versionedDocumentHandle, selectCommit, changeId]);

  useEffect(() => {
    const loadDocument = async (docHandle: VersionedDocumentHandle) => {
      const versionedDocument = await docHandle.doc();
      if (versionedDocument) {
        document.title = `v2 | "${versionedDocument.title}" version history`;
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
    <ProseMirrorProvider>
      <SidebarLayout
        sidebar={
          <ChangeLogSidebar
            commits={commits}
            onCommitClick={handleCommitClick}
            selectedCommit={changeId}
          />
        }
      >
        <>
          {doc ? (
            <div className="flex flex-auto flex-col items-stretch overflow-auto outline-none">
              <ActionsBar
                isSidebarOpen={isSidebarOpen}
                onSidebarToggle={toggleSidebar}
                // TODO: Implement revert functionality
                onRevertIconClick={() => {}}
                title={viewTitle}
              />
              {diffProps ? (
                <ReadOnlyView {...diffProps} />
              ) : (
                <ReadOnlyView doc={doc} />
              )}
            </div>
          ) : (
            // TODO: Use a spinner
            <div>Loading...</div>
          )}
        </>
      </SidebarLayout>
    </ProseMirrorProvider>
  );
};
