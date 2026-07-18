import { createContext } from 'react';

import { type CurrentDocumentContextType } from './types';

// The defaults are inert placeholders that satisfy `createContext` — reading
// this context outside `CurrentDocumentProvider` yields them rather than an error.
export const CurrentDocumentContext = createContext<CurrentDocumentContextType>(
  {
    versionedDocumentId: null,
    versionedDocument: null,
    onDocumentContentChange: async () => {},
    loadingHistory: false,
    versionedDocumentHistory: [],
    canCommit: false,
    reloadDocumentHistory: async () => {},
    onRestoreCommit: async () => {},
    onDiscardChanges: async () => {},
    isRestoreCommitDialogOpen: false,
    isDiscardChangesDialogOpen: false,
    commitToRestore: null,
    onOpenRestoreCommitDialog: () => {},
    onCloseRestoreCommitDialog: () => {},
    onOpenDiscardChangesDialog: () => {},
    onCloseDiscardChangesDialog: () => {},
    selectedCommitIndex: null,
    onSelectChange: () => {},
  }
);
