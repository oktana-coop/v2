// Project store manager adapters
export { createAdapter as createElectronRendererProjectStoreManagerAdapter } from './adapters/git/git-project-store-manager/electron-renderer-ipc';
export { createAdapter as createElectronRendererAutomergeProjectStoreManagerAdapter } from './adapters/automerge/automerge-project-store-manager/electron-renderer-indexed-db';
// Currently used for Git. This adapter is really generic, it just delegates to the main process via IPC.
export { createAdapter as createBrowserAutomergeProjectStoreManagerAdapter } from './adapters/automerge/automerge-project-store-manager/browser-indexed-db';

export { createAdapter as createElectronAssetProtocolAdapter } from './adapters/asset-url-protocol/electron-asset-protocol';
