import React, { useCallback, useContext, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';

import {
  type VersionedDocument,
  type VersionedDocumentHandle,
} from '../../../../../../modules/domain/rich-text';
import {
  type Change,
  type ChangeWithUrlInfo,
  decodeURLHeads,
  encodeURLHeads,
  headsAreSame,
  isCommit,
  UrlHeads,
} from '../../../../../../modules/infrastructure/version-control';
import { FunctionalityConfigContext } from '../../../../../../modules/personalization/functionality-config';
import {
  CurrentDocumentContext,
  SidebarLayoutContext,
} from '../../../../app-state';
import { useCurrentDocumentName } from '../../../../hooks';
import { ActionsBar } from './ActionsBar';
import { type DiffViewProps, ReadOnlyView } from './ReadOnlyView';

export const DocumentHistoricalView = () => {
  const { changeId, documentId } = useParams();
  const {
    versionedDocumentHandle,
    versionedDocumentHistory: commits,
    selectedCommitIndex,
    onSelectCommit,
    canCommit,
    onOpenCommitDialog,
    getDocumentHandleAtCommit,
    isContentSameAtHeads,
  } = useContext(CurrentDocumentContext);
  const { isSidebarOpen, toggleSidebar } = useContext(SidebarLayoutContext);
  const [doc, setDoc] = React.useState<VersionedDocument | null>();
  const [viewTitle, setViewTitle] = useState<string>('');
  const [diffProps, setDiffProps] = useState<DiffViewProps | null>(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const currentDocumentName = useCurrentDocumentName();

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
          const isContentBetweenCommitsDifferent = !isContentSameAtHeads({
            document: currentCommitDoc,
            heads1: diffCommit.heads,
            heads2: commits[currentCommitIndex].heads,
          });

          if (
            previousCommitDoc &&
            currentCommitDoc &&
            isContentBetweenCommitsDifferent
          ) {
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
      selectedCommitIndex !== null &&
      selectedCommitIndex >= 0
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
    const updateBrowserTabTitle = async (name: string) => {
      window.document.title = `v2 | "${name}" history`;
    };

    if (currentDocumentName) {
      updateBrowserTabTitle(currentDocumentName);
    }
  }, [currentDocumentName]);

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

  const handleEditClick = () => {
    navigate(`/documents/${documentId}`);
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
        canCommit={canCommit}
        lastChangeIsCommitAndSelected={Boolean(
          selectedCommitIndex === 0 && isCommit(commits[selectedCommitIndex])
        )}
        uncommittedChangesSelected={Boolean(
          selectedCommitIndex === 0 && !isCommit(commits[selectedCommitIndex])
        )}
        onCommitIconClick={onOpenCommitDialog}
        onEditIconClick={handleEditClick}
      />
      {diffProps ? <ReadOnlyView {...diffProps} /> : <ReadOnlyView doc={doc} />}
    </div>
  );
};
