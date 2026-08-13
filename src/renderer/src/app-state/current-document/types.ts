import { type ShareUrl } from '../../../../modules/domain/project';
import { type LiveDocument } from '../../../../modules/domain/rich-text';
import {
  type ArtifactId,
  type ChangeId,
  type ChangeWithUrlInfo,
  type Commit,
} from '../../../../modules/infrastructure/version-control';

export type CurrentDocumentContextType = {
  versionedDocumentId: ArtifactId | null;
  liveDocument: LiveDocument | null;
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
  // The share the open document takes part in, if any.
  shareUrl: ShareUrl | null;
  onShareDocument: () => Promise<void>;
  onJoinSharedDocument: (shareUrl: ShareUrl) => Promise<void>;
  onLeaveSharedDocument: () => Promise<void>;
  isShareDocumentDialogOpen: boolean;
  isJoinSharedDocumentDialogOpen: boolean;
  onOpenShareDocumentDialog: () => void;
  onCloseShareDocumentDialog: () => void;
  onOpenJoinSharedDocumentDialog: () => void;
  onCloseJoinSharedDocumentDialog: () => void;
};
