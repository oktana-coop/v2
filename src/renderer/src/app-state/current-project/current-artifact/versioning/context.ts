import { createContext } from 'react';

import { type CurrentArtifactVersioningContextType } from './types';

// The defaults are inert placeholders that satisfy `createContext` — reading
// this context outside `CurrentArtifactVersioningProvider` yields them rather
// than an error.
export const CurrentArtifactVersioningContext =
  createContext<CurrentArtifactVersioningContextType>({
    versionedDocumentId: null,
    loadingHistory: false,
    versionedDocumentHistory: [],
    canCommit: false,
    onSelectChange: () => {},
    onCommitDocumentChanges: async () => false,
    reloadDocumentHistory: async () => {},
    onRestoreCommit: async () => {},
    onDiscardChanges: async () => {},
    commitToRestore: null,
    isRestoreCommitDialogOpen: false,
    isDiscardChangesDialogOpen: false,
    onOpenRestoreCommitDialog: () => {},
    onCloseRestoreCommitDialog: () => {},
    onOpenDiscardChangesDialog: () => {},
    onCloseDiscardChangesDialog: () => {},
  });
