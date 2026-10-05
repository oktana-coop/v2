import { createContext } from 'react';

import { type CurrentDocumentContextType } from './types';

// The defaults are inert placeholders that satisfy `createContext` — reading
// this context outside `CurrentDocumentProvider` yields them rather than an error.
export const CurrentDocumentContext = createContext<CurrentDocumentContextType>(
  {
    liveDocument: null,
    onLocalSelectionChange: () => {},
    shareId: null,
    onShareDocument: async () => null,
    onJoinSharedDocument: async () => null,
    onSwitchToBranchAndJoin: async () => null,
    onLeaveSharedDocument: async () => {},
    isShareDocumentDialogOpen: false,
    isJoinSharedDocumentDialogOpen: false,
    onOpenShareDocumentDialog: () => {},
    onCloseShareDocumentDialog: () => {},
    onOpenJoinSharedDocumentDialog: () => {},
    onCloseJoinSharedDocumentDialog: () => {},
  }
);
