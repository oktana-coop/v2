export * from './index';

export { createAdapter as createNodeAutomergeSingleDocumentProjectStoreManagerAdapter } from './adapters/single-document-project/automerge/automerge-project-store-manager/electron-node-sqlite';
export { createAdapter as createNodeAutomergeMultiDocumentProjectStoreManagerAdapter } from './adapters/multi-document-project/automerge/automerge-project-store-manager/electron-node-fs';

export { createAdapter as createNodeGitSingleDocumentProjectStoreManagerAdapter } from './adapters/single-document-project/git/git-project-store-manager/node-sqlite';
export { createAdapter as createNodeGitMultiDocumentProjectStoreManagerAdapter } from './adapters/multi-document-project/git/git-project-store-manager/electron-node-fs';
