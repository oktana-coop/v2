import {
  type ShareId,
  type StoredLiveDocument,
} from '../../../../modules/domain/project';
import { type ParticipantSelection } from '../../../../modules/domain/rich-text';
import {
  type ArtifactId,
  type Branch,
  type ChangeId,
  type ChangeWithUrlInfo,
  type Commit,
} from '../../../../modules/infrastructure/version-control';

export type JoinSharedDocumentRefusal =
  | { reason: 'other-branch'; branch: Branch; canSwitch: boolean }
  | { reason: 'not-in-project' };

export type CurrentDocumentContextType = {
  versionedDocumentId: ArtifactId | null;
  liveDocument: StoredLiveDocument | null;
  // Where we are in the open document, for whoever else is at it.
  onLocalSelectionChange: (selection: ParticipantSelection | null) => void;
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
  shareId: ShareId | null;
  // Resolves to the share ID so the caller can act on it right away.
  onShareDocument: () => Promise<ShareId | null>;
  // Resolves to why the join was refused here, or null once joined.
  onJoinSharedDocument: (
    shareId: ShareId
  ) => Promise<JoinSharedDocumentRefusal | null>;
  // Switches to the share's branch and joins there.
  onSwitchToBranchAndJoin: (args: {
    shareId: ShareId;
    branch: Branch;
  }) => Promise<JoinSharedDocumentRefusal | null>;
  onLeaveSharedDocument: () => Promise<void>;
  isShareDocumentDialogOpen: boolean;
  isJoinSharedDocumentDialogOpen: boolean;
  onOpenShareDocumentDialog: () => void;
  onCloseShareDocumentDialog: () => void;
  onOpenJoinSharedDocumentDialog: () => void;
  onCloseJoinSharedDocumentDialog: () => void;
};
