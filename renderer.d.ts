import type { IpcRenderer } from 'electron';

import { type IPCResult } from './src/modules/electron/ipc-effect/types';
import type { Filesystem as FilesystemAPI } from './src/modules/filesystem';
import type {
  FromMainMessage,
  FromRendererMessage,
  VersionControlId,
} from './src/modules/version-control';
import type { Wasm as WasmAPI } from './src/modules/wasm';
import { type PromisifiedAPI } from './src/utils/effect';

export type ElectronAPI = {
  onReceiveProcessId: (callback: (processId: string) => void) => IpcRenderer;
  sendCurrentDocumentId: (id: VersionControlId) => void;
  openExternalLink: (url: string) => void;
};

export type AutomergeRepoNetworkAdapter = {
  sendRendererProcessMessage: (message: FromRendererMessage) => void;
  onReceiveMainProcessMessage: (
    callback: (message: FromMainMessage) => void
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

type FilesystemPromiseAPI = PromisifiedAPI<FilesystemAPI, IPCResult>;

declare global {
  interface Window {
    electronAPI: ElectronAPI;
    automergeRepoNetworkAdapter: AutomergeRepoNetworkAdapter;
    filesystemAPI: FilesystemPromiseAPI;
    versionControlAPI: VersionControlAPI;
    wasmAPI: WasmAPI;
  }
}
