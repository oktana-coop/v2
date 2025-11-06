import React, { useCallback, useContext, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router';

import { isValidProjectId } from '../../../../../../modules/domain/project';
import { type VersionedDocument } from '../../../../../../modules/domain/rich-text';
import {
  type Change,
  changeIdsAreSame,
  type ChangeWithUrlInfo,
  type CommitId,
  decodeUrlEncodedChangeId,
  isCommit,
  type ResolvedArtifactId,
  urlEncodeChangeId,
} from '../../../../../../modules/infrastructure/version-control';
import { FunctionalityConfigContext } from '../../../../../../modules/personalization/browser';
import {
  CurrentDocumentContext,
  SidebarLayoutContext,
} from '../../../../app-state';
import { LongTextSkeleton } from '../../../../components/progress/skeletons/LongText';
import {
  useCurrentDocumentId,
  useCurrentDocumentName,
  useNavigateToDocument,
} from '../../../../hooks';
import { ActionsBar } from './ActionsBar';
import { type DiffViewProps, ReadOnlyView } from './ReadOnlyView';

export const DocumentHistoricalView = () => {
  const { changeId, projectId } = useParams();
  const documentId = useCurrentDocumentId();
  const {
    versionedDocumentHistory: commits,
    selectedCommitIndex,
    onSelectChange,
    canCommit,
    onOpenCommitDialog,
    getDocumentAtChange,
    isContentSameAtCommits,
  } = useContext(CurrentDocumentContext);
  const { isSidebarOpen, toggleSidebar } = useContext(SidebarLayoutContext);
  const [doc, setDoc] = React.useState<VersionedDocument | null>(null);
  const [viewTitle, setViewTitle] = useState<string>('');
  const [diffProps, setDiffProps] = useState<DiffViewProps | null>(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const navigateToDocument = useNavigateToDocument();
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
      const decodedChangeId = decodeUrlEncodedChangeId(diffWithParam);
      if (decodedChangeId) {
        return decodedChangeId;
      }
    }
    return null;
  }, [searchParams]);

  useEffect(() => {
    const loadDocOrDiff = async (
      documentId: ResolvedArtifactId,
      changes: ChangeWithUrlInfo[],
      currentChangeIndex: number
    ) => {
      const currentChangeDoc = await getDocumentAtChange({
        documentId,
        changeId: changes[currentChangeIndex].id,
      });

      const isFirstCommit = isInitialChange(currentChangeIndex, commits);

      if (!showDiffInHistoryView || isFirstCommit) {
        setDiffProps(null);
      } else {
        const diffWith = getDecodedDiffParam();
        const diffCommit =
          diffWith &&
          changes.find((commit) => changeIdsAreSame(commit.id, diffWith));

        if (diffCommit) {
          const previousCommitDoc = await getDocumentAtChange({
            documentId,
            changeId: diffCommit.id,
          });
          const isContentBetweenCommitsDifferent =
            !(await isContentSameAtCommits({
              documentId,
              commit1: diffCommit.id,
              commit2: changes[currentChangeIndex].id,
            }));

          if (
            previousCommitDoc &&
            currentChangeDoc &&
            isContentBetweenCommitsDifferent
          ) {
            setDiffProps({
              docBefore: previousCommitDoc,
              docAfter: currentChangeDoc,
            });
          }
        } else {
          setDiffProps(null);
        }
      }

      setDoc(currentChangeDoc);
      updateViewTitle(commits[currentChangeIndex]);
    };

    if (
      documentId &&
      commits.length > 0 &&
      selectedCommitIndex !== null &&
      selectedCommitIndex >= 0
    ) {
      loadDocOrDiff(documentId, commits, selectedCommitIndex);
    }
  }, [
    documentId,
    commits,
    showDiffInHistoryView,
    selectedCommitIndex,
    getDecodedDiffParam,
  ]);

  useEffect(() => {
    if (commits.length > 0) {
      if (changeId) {
        const decodedChangeId = decodeUrlEncodedChangeId(changeId);
        if (!decodedChangeId) {
          console.error('Invalid commit ID for the selected commit:', changeId);
          return;
        }
        onSelectChange(decodedChangeId);
      } else {
        // If no changeId is provided, we select the last commit
        const [lastChange] = commits;
        onSelectChange(lastChange.id);
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

  const handleDiffCommitSelect = (id: CommitId) => {
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);
      const encodedCommitId = urlEncodeChangeId(id);
      newParams.set('diffWith', encodedCommitId);
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
    if (isValidProjectId(projectId) && documentId) {
      navigateToDocument({
        projectId,
        documentId,
        path: null,
      });
    }
  };

  return (
    <div className="flex flex-auto flex-col items-center">
      <div className="w-full">
        <ActionsBar
          isSidebarOpen={isSidebarOpen}
          onSidebarToggle={toggleSidebar}
          // TODO: Implement revert functionality
          onRevertIconClick={() => {}}
          title={viewTitle}
          canShowDiff={
            !selectedCommitIndex ||
            !isInitialChange(selectedCommitIndex, commits)
          }
          showDiff={showDiffInHistoryView}
          onSetShowDiffChecked={handleSetShowDiffInHistoryView}
          diffWith={getDecodedDiffParam()}
          history={
            selectedCommitIndex
              ? commits.slice(selectedCommitIndex + 1)
              : commits
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
      </div>

      <div className="flex w-full flex-auto flex-col items-center overflow-auto">
        <div className="flex w-full max-w-3xl flex-col">
          <MainContent diffProps={diffProps} doc={doc} />
        </div>
      </div>
    </div>
  );
};

const MainContent = ({
  diffProps,
  doc,
}: {
  diffProps: DiffViewProps | null;
  doc: VersionedDocument | null;
}) => {
  if (!doc) {
    return <LongTextSkeleton />;
  }

  if (diffProps) {
    return <ReadOnlyView {...diffProps} />;
  }

  return <ReadOnlyView doc={doc} />;
};
