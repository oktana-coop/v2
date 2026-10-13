import { createContext } from 'react';

import { type ShareId } from '../../../../modules/domain/collaboration';
import { type ParticipantSelection as PlainTextParticipantSelection } from '../../../../modules/domain/plain-text';
import {
  type artifactKinds,
  type NamedLivePlainTextDocument,
  type NamedLiveRichTextDocument,
} from '../../../../modules/domain/project';
import { type ParticipantSelection } from '../../../../modules/domain/rich-text';

export type GuestRichTextDocument = {
  kind: typeof artifactKinds.RICH_TEXT_DOCUMENT;
  liveDocument: NamedLiveRichTextDocument;
  onLocalSelectionChange: (selection: ParticipantSelection | null) => void;
};

export type GuestPlainTextDocument = {
  kind: typeof artifactKinds.PLAIN_TEXT_DOCUMENT;
  liveDocument: NamedLivePlainTextDocument;
  onLocalSelectionChange: (
    selection: PlainTextParticipantSelection | null
  ) => void;
};

export type GuestDocument = GuestRichTextDocument | GuestPlainTextDocument;

export type GuestEditingContextType = {
  shareId: ShareId | null;
  guestDocument: GuestDocument | null;
  name: string | null;
  onLeave: (shareId: ShareId) => Promise<void>;
  isSharingDialogOpen: boolean;
  onOpenSharingDialog: () => void;
  onCloseSharingDialog: () => void;
  isJoinDialogOpen: boolean;
  onOpenJoinDialog: () => void;
  onCloseJoinDialog: () => void;
};

export const GuestEditingContext = createContext<GuestEditingContextType>({
  shareId: null,
  guestDocument: null,
  name: null,
  onLeave: async () => {},
  isSharingDialogOpen: false,
  onOpenSharingDialog: () => {},
  onCloseSharingDialog: () => {},
  isJoinDialogOpen: false,
  onOpenJoinDialog: () => {},
  onCloseJoinDialog: () => {},
});
