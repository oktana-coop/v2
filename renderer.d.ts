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
import { type UpdateState } from './src/modules/infrastructure/cross-platform/update';
import {
  type File,
  type Filesystem as FilesystemAPI,
} from './src/modules/infrastructure/filesystem';
import {
  type FromMainMessage as AutomergeRepoNetworkFromMainIPCMessage,
  type FromRendererMessage as AutomergeRepoNetworkFromRendererIPCMessage,
  type ResolvedArtifactId,
} from './src/modules/infrastructure/version-control';
import { type Wasm as WasmAPI } from './src/modules/infrastructure/wasm';
import {
  type ResolvedTheme,
  type Theme,
} from './src/modules/personalization/theme';

export type UnregisterListenerFn = () => void;

export type ElectronAPI = {
  onReceiveProcessId: (callback: (processId: string) => void) => IpcRenderer;
  sendCurrentDocumentId: (id: ResolvedArtifactId) => void;
  openExternalLink: (url: string) => void;
  clearWebStorage: () => Promise<void>;
  checkForUpdate: () => Promise<void>;
  onUpdateStateChange: (
    callback: (updateState: UpdateState) => void
  ) => () => void;
  downloadUpdate: () => Promise<void>;
  restartToInstallUpdate: () => Promise<void>;
  onToggleCommandPalette: (callback: () => void) => () => void;
};

export type PersonalizationAPI = {
  setTheme: (theme: Theme) => Promise<void>;
  getTheme: () => Promise<Theme>;
  getSystemTheme: () => Promise<Exclude<Theme, 'system'>>;
  onSystemThemeUpdate: (callback: (theme: ResolvedTheme) => void) => () => void;
};

export type AutomergeRepoNetworkAdapter = {
  sendRendererProcessMessage: (
    message: AutomergeRepoNetworkFromRendererIPCMessage
  ) => void;
  onReceiveMainProcessMessage: (
    callback: (message: AutomergeRepoNetworkFromMainIPCMessage) => void
  ) => UnregisterListenerFn;
};

export type SingleDocumentProjectStoreManagerAPI = {
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

export type MultiDocumentProjectStoreManagerAPI = {
  openOrCreateMultiDocumentProject: () => Promise<
    Pick<OpenOrCreateMultiDocumentProjectResult, 'projectId' | 'directory'>
  >;
  openMultiDocumentProjectById: (
    args: OpenMultiDocumentProjectByIdArgs
  ) => Promise<Pick<OpenMultiDocumentProjectByIdResult, 'directory'>>;
};

type FilesystemPromiseAPI = PromisifyEffects<FilesystemAPI>;

export type OsEventsAPI = {
  onOpenFileFromFilesystem: (callback: (file: File) => void) => () => void;
};

declare global {
  interface Window {
    electronAPI: ElectronAPI;
    personalizationAPI: PersonalizationAPI;
    automergeRepoNetworkAdapter: AutomergeRepoNetworkAdapter;
    filesystemAPI: FilesystemPromiseAPI;
    versionControlAPI: VersionControlAPI;
    singleDocumentProjectStoreManagerAPI: SingleDocumentProjectStoreManagerAPI;
    multiDocumentProjectStoreManagerAPI: MultiDocumentProjectStoreManagerAPI;
    wasmAPI: WasmAPI;
    osEventsAPI: OsEventsAPI;
  }
}
