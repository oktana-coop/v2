import React, { useCallback, useContext, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router';

import { isValidProjectId } from '../../../../../../modules/domain/project';
import { type VersionedDocument } from '../../../../../../modules/domain/rich-text';
import {
  type Change,
  type ChangeWithUrlInfo,
  decodeURLHeads,
  encodeURLHeads,
  headsAreSame,
  isCommit,
  type ResolvedArtifactId,
  UrlHeads,
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
    onSelectCommit,
    canCommit,
    onOpenCommitDialog,
    getDocumentAtCommit,
    isContentSameAtHeads,
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
      const decodedHeads = decodeURLHeads(diffWithParam);
      if (decodedHeads) {
        return decodedHeads;
      }
    }
    return null;
  }, [searchParams]);

  useEffect(() => {
    const loadDocOrDiff = async (
      documentId: ResolvedArtifactId,
      commits: ChangeWithUrlInfo[],
      currentCommitIndex: number
    ) => {
      const currentCommitDoc = await getDocumentAtCommit({
        documentId,
        heads: commits[currentCommitIndex].heads,
      });

      const isFirstCommit = isInitialChange(currentCommitIndex, commits);

      if (!showDiffInHistoryView || isFirstCommit) {
        setDiffProps(null);
      } else {
        const diffWith = getDecodedDiffParam();
        const diffCommit =
          diffWith &&
          commits.find((commit) => headsAreSame(commit.heads, diffWith));

        if (diffCommit) {
          const previousCommitDoc = await getDocumentAtCommit({
            documentId,
            heads: diffCommit.heads,
          });
          const isContentBetweenCommitsDifferent = !(await isContentSameAtHeads(
            {
              documentId,
              heads1: diffCommit.heads,
              heads2: commits[currentCommitIndex].heads,
            }
          ));

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
