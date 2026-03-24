import { useContext, useEffect, useMemo } from 'react';
import { useParams } from 'react-router';

import { isCommit } from '../../../../../../../../modules/infrastructure/version-control';
import { CurrentDocumentContext } from '../../../../../../app-state';
import { IconButton } from '../../../../../../components/actions/IconButton';
import {
  CheckIcon,
  PenIcon,
  RestoreCommitIcon,
  TrashIcon,
} from '../../../../../../components/icons';
import { useCurrentDocumentName } from '../../../../../../hooks';
import {
  HistoricalDocumentView,
  useHistoricalDocument,
} from '../../../../shared/historical-view';

const UncommittedChangesActions = ({
  onEdit,
  onDiscard,
  onCommit,
  canDiscard,
}: {
  onEdit: () => void;
  onDiscard: () => void;
  onCommit: () => void;
  canDiscard: boolean;
}) => (
  <>
    <IconButton icon={<PenIcon />} onClick={onEdit} tooltip="Edit Document" />
    {canDiscard && (
      <IconButton
        icon={<TrashIcon />}
        onClick={onDiscard}
        tooltip="Discard Changes"
      />
    )}
    <IconButton
      onClick={onCommit}
      icon={<CheckIcon />}
      color="purple"
      tooltip="Commit Changes"
    />
  </>
);

const CommittedChangeActions = ({
  onEdit,
  onRestore,
  isLatestCommit,
}: {
  onEdit: () => void;
  onRestore: () => void;
  isLatestCommit: boolean;
}) => (
  <>
    <IconButton
      icon={<PenIcon />}
      onClick={onEdit}
      tooltip="Edit Document (Current State)"
    />
    <IconButton
      onClick={onRestore}
      icon={<RestoreCommitIcon />}
      disabled={isLatestCommit}
      tooltip="Revert to this State"
    />
  </>
);

export const DocumentHistoricalView = () => {
  const { changeId: encodedChangeId } = useParams();
  const {
    versionedDocumentHistory: commits,
    onSelectChange,
    onOpenCommitDialog,
    onOpenRestoreCommitDialog,
    onOpenDiscardChangesDialog,
  } = useContext(CurrentDocumentContext);
  const currentDocumentName = useCurrentDocumentName();

  const {
    selectedChange,
    isUncommitted,
    navigateToEdit,
    documentPath,
    doc,
    diffProps,
    loading,
    error,
    showDiff,
    onSetShowDiff,
    diffCommitId,
    onDiffCommitSelect,
    canShowDiff,
    diffSelectorCommits,
  } = useHistoricalDocument({ changes: commits });

  // Auto-select first change when navigating to history without a changeId
  useEffect(() => {
    if (commits.length > 0 && !encodedChangeId) {
      onSelectChange(commits[0].id);
    }
  }, [commits, encodedChangeId]);

  // Set window title
  useEffect(() => {
    if (currentDocumentName) {
      window.document.title = `v2 | "${currentDocumentName}" history`;
    }
  }, [currentDocumentName]);

  const title = useMemo(() => {
    if (!selectedChange) return '';
    return isCommit(selectedChange)
      ? selectedChange.message
      : 'Uncommitted Changes';
  }, [selectedChange]);

  const isLatestCommit =
    selectedChange !== null &&
    isCommit(selectedChange) &&
    commits.length > 0 &&
    isCommit(commits[0]) &&
    selectedChange.id === commits[0].id;

  const actions = isUncommitted ? (
    <UncommittedChangesActions
      onEdit={navigateToEdit}
      onDiscard={onOpenDiscardChangesDialog}
      onCommit={onOpenCommitDialog}
      canDiscard={commits.length > 1}
    />
  ) : (
    <CommittedChangeActions
      onEdit={navigateToEdit}
      onRestore={() => {
        if (selectedChange && isCommit(selectedChange)) {
          onOpenRestoreCommitDialog(selectedChange);
        }
      }}
      isLatestCommit={isLatestCommit}
    />
  );

  return (
    <HistoricalDocumentView
      documentPath={documentPath}
      doc={doc}
      diffProps={diffProps}
      loading={loading}
      error={error}
      showDiff={showDiff}
      onSetShowDiff={onSetShowDiff}
      diffCommitId={diffCommitId}
      onDiffCommitSelect={onDiffCommitSelect}
      canShowDiff={canShowDiff}
      diffSelectorCommits={diffSelectorCommits}
      title={title}
      actions={actions}
    />
  );
};
