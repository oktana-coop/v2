import { useMemo } from 'react';
import { useOutletContext } from 'react-router';

import { removePath } from '../../../../../../../modules/infrastructure/filesystem';
import {
  type ChangedDocument,
  type Commit,
  isCommit,
  urlEncodeChangeId,
} from '../../../../../../../modules/infrastructure/version-control';
import { IconButton } from '../../../../../components/actions/IconButton';
import { PenIcon } from '../../../../../components/icons';
import {
  HistoricalDocumentView,
  useHistoricalArtifact,
} from '../../../shared/historical-view';
import { ProjectHistoryActionBarTitle } from './ProjectHistoryActionBarTitle';

export type ProjectHistoryOutletContext = {
  commits: Commit[];
  expandedCommitDocuments: Record<string, ChangedDocument[]>;
  uncommittedChanges: ChangedDocument[];
};

export const ProjectHistoryDocumentView = () => {
  const { commits, expandedCommitDocuments, uncommittedChanges } =
    useOutletContext<ProjectHistoryOutletContext>();

  const changesWithUrlInfo = useMemo(
    () =>
      commits.map((commit) => ({
        ...commit,
        urlEncodedChangeId: urlEncodeChangeId(commit.id),
      })),
    [commits]
  );

  const {
    selectedChange,
    isUncommitted,
    documentId,
    changeId,
    documentPath,
    kind,
    resolvingArtifact,
    navigateToEdit,
    showDiff,
    onSetShowDiff,
    diffCommitId,
    onDiffCommitSelect,
    canShowDiff,
    diffSelectorCommits,
  } = useHistoricalArtifact({ changes: changesWithUrlInfo });

  const docName = documentPath ? removePath(documentPath) : '';

  const selectedChangedDocument = useMemo((): ChangedDocument | null => {
    if (!documentPath) return null;

    if (isUncommitted) {
      return (
        uncommittedChanges.find((doc) => doc.path === documentPath) ?? null
      );
    }

    if (!selectedChange) return null;

    const key = urlEncodeChangeId(selectedChange.id);
    const documents = expandedCommitDocuments[key];
    if (documents) {
      return documents.find((doc) => doc.path === documentPath) ?? null;
    }

    return null;
  }, [
    documentPath,
    isUncommitted,
    selectedChange,
    uncommittedChanges,
    expandedCommitDocuments,
  ]);

  const commitMessage =
    selectedChange && !isUncommitted && isCommit(selectedChange)
      ? (selectedChange.message.split('\n')[0] ?? null)
      : null;

  return (
    <HistoricalDocumentView
      documentId={documentId}
      documentPath={documentPath}
      kind={kind}
      resolvingArtifact={resolvingArtifact}
      changeId={changeId}
      showDiff={showDiff}
      onSetShowDiff={onSetShowDiff}
      diffCommitId={diffCommitId}
      onDiffCommitSelect={onDiffCommitSelect}
      canShowDiff={canShowDiff}
      diffSelectorCommits={diffSelectorCommits}
      title={docName}
      titleComponent={
        <h3 className="flex flex-auto items-center text-left text-base/7">
          {docName}
          {selectedChangedDocument && (
            <ProjectHistoryActionBarTitle
              document={selectedChangedDocument}
              commitMessage={commitMessage}
            />
          )}
        </h3>
      }
      actions={
        isUncommitted ? (
          <IconButton
            icon={<PenIcon />}
            onClick={navigateToEdit}
            tooltip="Edit Document"
          />
        ) : undefined
      }
    />
  );
};
