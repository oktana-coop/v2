import type { IpcRenderer } from 'electron';

import { type PromisifyEffects } from './src/modules/cross-platform/electron-ipc-effect';
import {
  type OpenSingleDocumentProjectStoreResult,
  type SetupSingleDocumentProjectStoreResult,
} from './src/modules/domain/project';
import type { Filesystem as FilesystemAPI } from './src/modules/infrastructure/filesystem';
import type {
  AutomergeRepoNetworkIPCMessage,
  VersionControlId,
} from './src/modules/infrastructure/version-control';
import { type Wasm as WasmAPI } from './src/modules/infrastructure/wasm';

export type ElectronAPI = {
  onReceiveProcessId: (callback: (processId: string) => void) => IpcRenderer;
  sendCurrentDocumentId: (id: VersionControlId) => void;
  openExternalLink: (url: string) => void;
};

export type AutomergeRepoNetworkAdapter = {
  sendRendererProcessMessage: (message: AutomergeRepoNetworkIPCMessage) => void;
  onReceiveMainProcessMessage: (
    callback: (message: AutomergeRepoNetworkIPCMessage) => void
  ) => IpcRenderer;
};

export type VersionControlAPI = {
  openOrCreateProject: (args: {
    directoryPath: string;
  }) => Promise<VersionControlId>;
  openProject: (args: {
    projectId: VersionControlId;
    directoryPath: string;
  }) => Promise<void>;
};

export type SingleDocumentProjectAPI = {
  createSingleDocumentProject: (args: {
    suggestedName: string;
  }) => Promise<
    Pick<
      SetupSingleDocumentProjectStoreResult,
      'projectId' | 'documentId' | 'file'
    >
  >;
  openSingleDocumentProject: () => Promise<
    Pick<
      OpenSingleDocumentProjectStoreResult,
      'projectId' | 'documentId' | 'file'
    >
  >;
};

type FilesystemPromiseAPI = PromisifyEffects<FilesystemAPI>;

declare global {
  interface Window {
    electronAPI: ElectronAPI;
    automergeRepoNetworkAdapter: AutomergeRepoNetworkAdapter;
    filesystemAPI: FilesystemPromiseAPI;
    versionControlAPI: VersionControlAPI;
    singleDocumentProjectAPI: SingleDocumentProjectAPI;
    wasmAPI: WasmAPI;
  }
}
