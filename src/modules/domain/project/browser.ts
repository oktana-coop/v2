// Single-document project store manager adapters
export { createAdapter as createElectronRendererIpcSingleDocumentProjectStoreManagerAdapter } from './adapters/single-document-project/git/git-project-store-manager/electron-renderer-ipc';
export { createAdapter as createElectronRendererAutomergeSingleDocumentProjectStoreManagerAdapter } from './adapters/single-document-project/automerge/automerge-project-store-manager/electron-renderer-indexed-db';
// Currently used for Git. This adapter is really generic, it just delegates to the main process via IPC.
export { createAdapter as createBrowserAutomergeSingleDocumentProjectStoreManagerAdapter } from './adapters/single-document-project/automerge/automerge-project-store-manager/browser-indexed-db';

// Multi-document project store manager adapters
export { createAdapter as createElectronRendererMultiDocumentProjectStoreManagerAdapter } from './adapters/multi-document-project/git/git-project-store-manager/electron-renderer-ipc';
export { createAdapter as createElectronRendererAutomergeMultiDocumentProjectStoreManagerAdapter } from './adapters/multi-document-project/automerge/automerge-project-store-manager/electron-renderer-indexed-db';
// Currently used for Git. This adapter is really generic, it just delegates to the main process via IPC.
export { createAdapter as createBrowserAutomergeMultiDocumentProjectStoreManagerAdapter } from './adapters/multi-document-project/automerge/automerge-project-store-manager/browser-indexed-db';
