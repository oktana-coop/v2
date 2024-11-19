import type { IpcRenderer } from 'electron';

import type { Filesystem as FilesystemAPI } from './src/modules/filesystem';
import type {
  FromMainMessage,
  FromRendererMessage,
  VersionControlId,
} from './src/modules/version-control';

export type ElectronAPI = {
  onReceiveProcessId: (callback: (processId: string) => void) => IpcRenderer;
  sendCurrentDocumentId: (id: VersionControlId) => void;
};

export type AutomergeRepoNetworkAdapter = {
  sendRendererProcessMessage: (message: FromRendererMessage) => void;
  onReceiveMainProcessMessage: (
    callback: (message: FromMainMessage) => void
  ) => IpcRenderer;
};

declare global {
  interface Window {
    electronAPI: ElectronAPI;
    automergeRepoNetworkAdapter: AutomergeRepoNetworkAdapter;
    filesystemAPI: FilesystemAPI;
  }
}
