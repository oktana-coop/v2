import React, { useCallback, useContext, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router';

import { SelectedFileContext } from '../../../../../modules/editor-state';
import { SidebarLayoutContext } from '../../../../../modules/editor-state/sidebar-layout/context';
import { FunctionalityConfigContext } from '../../../../../modules/personalization/functionality-config';
import {
  type Change,
  type ChangeWithUrlInfo,
  decodeURLHeads,
  encodeURLHeads,
  getDiff,
  headsAreSame,
  isCommit,
  UrlHeads,
  type VersionedDocument,
  type VersionedDocumentHandle,
} from '../../../../../modules/version-control';
import { VersionControlContext } from '../../../../../modules/version-control/react';
import { ActionsBar } from './ActionsBar';
import { type DiffViewProps, ReadOnlyView } from './ReadOnlyView';

export const DocumentHistory = () => {
  const { changeId } = useParams();
  const {
    versionedDocumentHandle,
    versionedDocumentHistory: commits,
    selectedCommitIndex,
    onSelectCommit,
  } = useContext(SelectedFileContext);
  const { getDocumentHandleAtCommit } = useContext(VersionControlContext);
  const { isSidebarOpen, toggleSidebar } = useContext(SidebarLayoutContext);
  const [doc, setDoc] = React.useState<VersionedDocument | null>();
  const [viewTitle, setViewTitle] = useState<string>('');
  const [diffProps, setDiffProps] = useState<DiffViewProps | null>(null);

  const [searchParams, setSearchParams] = useSearchParams();

  const { showDiffInHistoryView, setShowDiffInHistoryView } = useContext(
    FunctionalityConfigContext
  );

  const isInitialChange = (index: number, changes: Change[]) =>
    index === changes.length - 1;

  const updateViewTitle = (change: Change) => {
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
      commits: ChangeWithUrlInfo[],
      currentCommitIndex: number
    ) => {
      const currentCommitDocHandle = await getDocumentHandleAtCommit({
        documentHandle: docHandle,
        heads: commits[currentCommitIndex].heads,
      });
      const currentCommitDoc = await currentCommitDocHandle.doc();

      const isFirstCommit = isInitialChange(currentCommitIndex, commits);

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
          // TODO: Use heads instead of hashes
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

    if (
      versionedDocumentHandle &&
      commits.length > 0 &&
      selectedCommitIndex !== null
    ) {
      loadDocOrDiff(versionedDocumentHandle, commits, selectedCommitIndex);
    }
  }, [
    getDocumentHandleAtCommit,
    versionedDocumentHandle,
    commits,
    showDiffInHistoryView,
    searchParams,
    getDecodedDiffParam,
    selectedCommitIndex,
  ]);

  useEffect(() => {
    if (commits.length > 0) {
      if (changeId) {
        const urlHeads = decodeURLHeads(changeId);
        if (!urlHeads) {
          console.error('Invalid url heads for the selected commit:', changeId);
          return;
        }
        onSelectCommit(urlHeads);
      } else {
        // If no changeId is provided, we select the last commit
        const [lastChange] = commits;
        onSelectCommit(lastChange.heads);
      }
    }

    // Consciously omitting selectCommit from the dependency array because it ends up
    // resetting the selected diff commit as you check/uncheck the diff checkbox.
    // It's a small detail but it makes the experience smoother.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commits, changeId]);

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

  const handleDiffCommitSelect = (heads: UrlHeads) => {
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);
      const encodedHeads = encodeURLHeads(heads);
      newParams.set('diffWith', encodedHeads);
      return newParams;
    });
  };

  const handleSetShowDiffInHistoryView = (checked: boolean) => {
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);
      if (checked) {
        newParams.set('showDiff', 'true');
      } else {
        newParams.delete('showDiff');
      }
      return newParams;
    });

    return setShowDiffInHistoryView(checked);
  };

  if (!doc) {
    return (
      // TODO: Use a spinner
      <div>Loading...</div>
    );
  }

  return (
    <div className="flex flex-auto flex-col items-stretch overflow-auto outline-none">
      <ActionsBar
        isSidebarOpen={isSidebarOpen}
        onSidebarToggle={toggleSidebar}
        // TODO: Implement revert functionality
        onRevertIconClick={() => {}}
        title={viewTitle}
        canShowDiff={
          !selectedCommitIndex || !isInitialChange(selectedCommitIndex, commits)
        }
        showDiff={showDiffInHistoryView}
        onSetShowDiffChecked={handleSetShowDiffInHistoryView}
        diffWith={getDecodedDiffParam()}
        history={
          selectedCommitIndex ? commits.slice(selectedCommitIndex + 1) : commits
        }
        onDiffCommitSelect={handleDiffCommitSelect}
      />
      {diffProps ? <ReadOnlyView {...diffProps} /> : <ReadOnlyView doc={doc} />}
    </div>
  );
};
