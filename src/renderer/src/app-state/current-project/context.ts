import { createContext } from 'react';

import { type ProjectContextType } from './types';

// The defaults are inert placeholders that satisfy `createContext` — reading
// this context outside `ProjectProvider` yields them rather than an error.
export const ProjectContext = createContext<ProjectContextType>({
  resolving: false,
  projectId: null,
  directory: null,
  currentBranch: null,
  projectStore: null,
  currentArtifact: null,
  resolvingCurrentArtifact: false,
  directoryTree: [],
  subscribeToProjectContentChangeEvents: () => () => {},
  // @ts-expect-error will get overriden by the provider
  openDirectory: async () => null,
  // @ts-expect-error will get overriden by the provider
  requestPermissionForSelectedDirectory: async () => null,
  // @ts-expect-error will get overriden by the provider
  findDocumentInProject: async () => null,
  pendingNewDocument: null,
  startCreateDocument: () => {},
  createDocument: async () => {},
  cancelCreateDocument: () => {},
  createDocumentError: null,
  clearCreateDocumentError: () => {},
  pendingNewDirectory: null,
  startCreateDirectory: () => {},
  // @ts-expect-error will get overriden by the provider
  createDirectory: async () => null,
  cancelCreateDirectory: () => {},
  filePathToDelete: null,
  startDeleteDocument: () => {},
  deleteDocument: async () => {},
  confirmDeleteDocument: () => {},
  cancelDeleteDocument: () => {},
  directoryPathToDelete: null,
  startDeleteDirectory: () => {},
  deleteDirectory: async () => {},
  confirmDeleteDirectory: () => {},
  cancelDeleteDirectory: () => {},
  filePathToRename: null,
  startRenameDocument: () => {},
  renameDocumentError: null,
  clearRenameDocumentError: () => {},
  renameDocument: async () => {},
  cancelRenameDocument: () => {},
  directoryPathToRename: null,
  startRenameDirectory: () => {},
  renameDirectoryError: null,
  clearRenameDirectoryError: () => {},
  renameDirectory: async () => {},
  cancelRenameDirectory: () => {},
  getProjectHistory: async () => [],
  getProjectChangedDocuments: async () => [],
  getProjectUncommittedChanges: async () => [],
  commitChanges: async () => {},
});
