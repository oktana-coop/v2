import React, { useCallback, useContext, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { SelectedFileContext } from '../../../../modules/editor-state';
import { SidebarLayoutContext } from '../../../../modules/editor-state/sidebar-layout/context';
import { FunctionalityConfigContext } from '../../../../modules/personalization/functionality-config';
import { ProseMirrorProvider } from '../../../../modules/rich-text/react/context';
import {
  type Commit,
  decodeURLHeads,
  getDiff,
  getDocumentHandleHistory,
  getURLEncodedHeads,
  headsAreSame,
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
  const [searchParams] = useSearchParams();

  const { showDiffInHistoryView, setShowDiffInHistoryView } = useContext(
    FunctionalityConfigContext
  );

  const updateViewTitle = (change: Commit | UncommitedChange) => {
    if (isCommit(change)) {
      setViewTitle(change.message);
    } else {
      setViewTitle('Uncommitted Changes');
    }
  };

  const getDecodedDiffParam = useCallback(() => {
    const diffWithParam = searchParams.get('diffWith');
    if (diffWithParam) {
      const decodedHeads = decodeURLHeads(diffWithParam);
      if (decodedHeads) {
        return decodedHeads;
      }
    }
    return null;
  }, [searchParams]);

  useEffect(() => {
    const loadDocOrDiff = async (
      docHandle: VersionedDocumentHandle,
      commits: (Commit | UncommitedChange)[],
      changeId: Commit['hash']
    ) => {
      const currentCommitIndex = commits.findIndex(
        (commit) => commit.hash === changeId
      );

      const currentCommitDocHandle = await getDocumentHandleAtCommit({
        documentHandle: docHandle,
        heads: commits[currentCommitIndex].heads,
      });
      const currentCommitDoc = await currentCommitDocHandle.doc();

      const isFirstCommit = currentCommitIndex === commits.length - 1;

      if (!showDiffInHistoryView || isFirstCommit) {
        setDiffProps(null);
      } else {
        const diffWith = getDecodedDiffParam();
        const diffCommit =
          diffWith &&
          commits.find((commit) => headsAreSame(commit.heads, diffWith));

        if (diffCommit) {
          const diffCommitDocHandle = await getDocumentHandleAtCommit({
            documentHandle: docHandle,
            heads: diffCommit.heads,
          });
          const previousCommitDoc = await diffCommitDocHandle.doc();
          const diffPatches = await getDiff(
            currentCommitDocHandle,
            diffCommit.hash,
            commits[currentCommitIndex].hash
          );

          if (previousCommitDoc && currentCommitDoc && diffPatches) {
            setDiffProps({
              docBefore: previousCommitDoc,
              docAfter: currentCommitDoc,
            });
          }
        } else {
          setDiffProps(null);
        }
      }

      setDoc(currentCommitDoc);
      updateViewTitle(commits[currentCommitIndex]);
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
    searchParams,
    getDecodedDiffParam,
  ]);

  const selectCommit = useCallback(
    (hash: string) => {
      const selectedCommitIndex = commits.findIndex(
        (commit) => commit.hash === hash
      );

      const isFirstCommit = selectedCommitIndex === commits.length - 1;

      const diffCommit = isFirstCommit
        ? null
        : commits[selectedCommitIndex + 1];

      let newUrl = `/history/${documentId}/${hash}`;
      if (diffCommit) {
        const diffCommitURLEncodedHeads = getURLEncodedHeads(diffCommit);
        newUrl += `?diffWith=${diffCommitURLEncodedHeads}`;
      }

      if (showDiffInHistoryView && diffCommit) {
        newUrl += `&showDiff`;
      }

      navigate(newUrl);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [documentId, commits, showDiffInHistoryView]
  );

  useEffect(() => {
    const loadHistory = (docHandle: VersionedDocumentHandle) => {
      const commits = getDocumentHandleHistory(docHandle);
      setCommits(commits);
    };

    if (versionedDocumentHandle) {
      loadHistory(versionedDocumentHandle);
    }
  }, [versionedDocumentHandle, changeId]);

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
                showDiff={showDiffInHistoryView}
                onSetShowDiffChecked={setShowDiffInHistoryView}
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
