export * from './index';
export { createAdapter as createNodeSingleDocumentProjectStoreManagerAdapter } from './adapters/single-document-project/automerge/automerge-project-store-manager/electron-node-sqlite';
export { createAdapter as createNodeMultiDocumentProjectStoreManagerAdapter } from './adapters/multi-document-project/git/git-project-store-manager/electron-node-fs';
