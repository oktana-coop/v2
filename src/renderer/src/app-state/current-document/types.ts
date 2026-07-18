import {
  type RichTextDocument,
  type VersionedDocument,
} from '../../../../modules/domain/rich-text';
import {
  type ArtifactId,
  type ChangeId,
  type ChangeWithUrlInfo,
  type Commit,
} from '../../../../modules/infrastructure/version-control';

export type CurrentDocumentContextType = {
  versionedDocumentId: ArtifactId | null;
  versionedDocument: VersionedDocument | null;
  onDocumentContentChange: (doc: RichTextDocument) => Promise<void>;
  loadingHistory: boolean;
  versionedDocumentHistory: ChangeWithUrlInfo[];
  canCommit: boolean;
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
  selectedCommitIndex: number | null;
  onSelectChange: (commitId: ChangeId) => void;
};
