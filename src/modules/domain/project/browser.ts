// Project store manager adapters
export { createAdapter as createElectronRendererProjectStoreManagerAdapter } from './adapters/git/git-project-store-manager/electron-renderer-ipc';
export { createAdapter as createElectronRendererAutomergeProjectStoreManagerAdapter } from './adapters/automerge/automerge-project-store-manager/electron-renderer-indexed-db';

export { createAdapter as createElectronAssetProtocolAdapter } from './adapters/asset-url-protocol/electron-asset-protocol';
