import { createContext } from 'react';

import {
  type NamedLiveDocument,
  type ShareId,
} from '../../../../modules/domain/project';
import { type ParticipantSelection } from '../../../../modules/domain/rich-text';

export type GuestEditingContextType = {
  shareId: ShareId | null;
  liveDocument: NamedLiveDocument | null;
  name: string | null;
  onLocalSelectionChange: (selection: ParticipantSelection | null) => void;
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
  liveDocument: null,
  name: null,
  onLocalSelectionChange: () => {},
  onLeave: async () => {},
  isSharingDialogOpen: false,
  onOpenSharingDialog: () => {},
  onCloseSharingDialog: () => {},
  isJoinDialogOpen: false,
  onOpenJoinDialog: () => {},
  onCloseJoinDialog: () => {},
});
