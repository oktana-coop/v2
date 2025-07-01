import type { IpcRenderer } from 'electron';

import { type PromisifyEffects } from './src/modules/cross-platform/electron-ipc-effect';
import {
  type OpenMultiDocumentProjectByIdArgs,
  type OpenMultiDocumentProjectByIdResult,
  type OpenOrCreateMultiDocumentProjectResult,
  type OpenSingleDocumentProjectStoreArgs,
  type OpenSingleDocumentProjectStoreResult,
  type SetupSingleDocumentProjectStoreArgs,
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

export type UnregisterListenerFn = () => void;

export type AutomergeRepoNetworkAdapter = {
  sendRendererProcessMessage: (message: AutomergeRepoNetworkIPCMessage) => void;
  onReceiveMainProcessMessage: (
    callback: (message: AutomergeRepoNetworkIPCMessage) => void
  ) => UnregisterListenerFn;
};

export type SingleDocumentProjectAPI = {
  createSingleDocumentProject: (
    args: SetupSingleDocumentProjectStoreArgs
  ) => Promise<
    Pick<
      SetupSingleDocumentProjectStoreResult,
      'projectId' | 'documentId' | 'file' | 'name'
    >
  >;
  openSingleDocumentProject: (
    args: OpenSingleDocumentProjectStoreArgs
  ) => Promise<
    Pick<
      OpenSingleDocumentProjectStoreResult,
      'projectId' | 'documentId' | 'file' | 'name'
    >
  >;
};

export type MultiDocumentProjectAPI = {
  openOrCreateMultiDocumentProject: () => Promise<
    Pick<OpenOrCreateMultiDocumentProjectResult, 'projectId' | 'directory'>
  >;
  openMultiDocumentProjectById: (
    args: OpenMultiDocumentProjectByIdArgs
  ) => Promise<Pick<OpenMultiDocumentProjectByIdResult, 'directory'>>;
};

type FilesystemPromiseAPI = PromisifyEffects<FilesystemAPI>;

declare global {
  interface Window {
    electronAPI: ElectronAPI;
    automergeRepoNetworkAdapter: AutomergeRepoNetworkAdapter;
    filesystemAPI: FilesystemPromiseAPI;
    versionControlAPI: VersionControlAPI;
    singleDocumentProjectAPI: SingleDocumentProjectAPI;
    multiDocumentProjectAPI: MultiDocumentProjectAPI;
    wasmAPI: WasmAPI;
  }
}
