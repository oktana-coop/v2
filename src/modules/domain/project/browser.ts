// Project store manager adapters
export { createAdapter as createElectronRendererProjectStoreManagerAdapter } from './adapters/git/git-project-store-manager/electron-renderer-ipc';

export { createAdapter as createElectronAssetProtocolAdapter } from './adapters/asset-url-protocol/electron-asset-protocol';

export { createAdapter as createBrowserLocalStorageShareRegistryAdapter } from './adapters/browser-local-storage-share-registry';
export {
  type DocumentShareKey,
  type RegisteredShare,
  type ShareRegistry,
} from './ports';

export { createAdapter as createBrowserLocalStorageGuestShareRegistryAdapter } from './adapters/browser-local-storage-guest-share-registry';
export { type GuestShare, type GuestShareRegistry } from './ports';
