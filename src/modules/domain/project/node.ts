export * from './index';

export { createAdapter as createNodeAutomergeMultiDocumentProjectStoreManagerAdapter } from './adapters/multi-document-project/automerge/automerge-project-store-manager/electron-node-fs';

export { createAdapter as createNodeGitMultiDocumentProjectStoreManagerAdapter } from './adapters/multi-document-project/git/git-project-store-manager/electron-node-fs';

export {
  createAdapter as createElectronAssetProtocolAdapter,
  PROJECT_ASSET_SCHEME,
} from './adapters/asset-url-protocol/electron-asset-protocol';
