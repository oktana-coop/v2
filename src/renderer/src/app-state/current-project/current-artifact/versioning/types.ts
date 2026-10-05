import {
  type ArtifactId,
  type ChangeId,
  type ChangeWithUrlInfo,
  type Commit,
} from '../../../../../../modules/infrastructure/version-control';

export type CurrentArtifactVersioningContextType = {
  versionedDocumentId: ArtifactId | null;
  loadingHistory: boolean;
  versionedDocumentHistory: ChangeWithUrlInfo[];
  canCommit: boolean;
  onSelectChange: (changeId: ChangeId) => void;
  // Resolves to whether the changes were committed.
  onCommitDocumentChanges: (message: string) => Promise<boolean>;
  reloadDocumentHistory: () => Promise<void>;
  onRestoreCommit: (args: { message: string; commit: Commit }) => Promise<void>;
  onDiscardChanges: () => Promise<void>;
  commitToRestore: Commit | null;
  isRestoreCommitDialogOpen: boolean;
  isDiscardChangesDialogOpen: boolean;
  onOpenRestoreCommitDialog: (commit: Commit) => void;
  onCloseRestoreCommitDialog: () => void;
  onOpenDiscardChangesDialog: () => void;
  onCloseDiscardChangesDialog: () => void;
};
