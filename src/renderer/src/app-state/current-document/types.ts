import { type ShareId } from '../../../../modules/domain/collaboration';
import { type ParticipantSelection as PlainTextParticipantSelection } from '../../../../modules/domain/plain-text';
import {
  type artifactKinds,
  type LivePlainTextDocument,
  type LiveRichTextDocument,
} from '../../../../modules/domain/project';
import { type ParticipantSelection } from '../../../../modules/domain/rich-text';
import { type Branch } from '../../../../modules/infrastructure/version-control';

export type JoinSharedDocumentRefusal =
  | { reason: 'other-branch'; branch: Branch; canSwitch: boolean }
  | { reason: 'not-in-project' };

export type CurrentRichTextDocument = {
  kind: typeof artifactKinds.RICH_TEXT_DOCUMENT;
  liveDocument: LiveRichTextDocument;
  onLocalSelectionChange: (selection: ParticipantSelection | null) => void;
};

export type CurrentPlainTextDocument = {
  kind: typeof artifactKinds.PLAIN_TEXT_DOCUMENT;
  liveDocument: LivePlainTextDocument;
  onLocalSelectionChange: (
    selection: PlainTextParticipantSelection | null
  ) => void;
};

export type CurrentDocument =
  CurrentRichTextDocument | CurrentPlainTextDocument;

export type CurrentDocumentContextType = {
  currentDocument: CurrentDocument | null;
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
