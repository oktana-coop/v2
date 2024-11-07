import type { IpcRenderer } from 'electron';

import {
  FromMainMessage,
  FromRendererMessage,
} from './src/modules/version-control';

export type ElectronAPI = {
  onReceiveProcessId: (callback: (processId: string) => void) => IpcRenderer;
};

export type AutomergeRepoNetworkAdapter = {
  sendRendererProcessMessage: (message: FromRendererMessage) => void;
  onReceiveMainProcessMessage: (message: FromMainMessage) => void;
};

declare global {
  interface Window {
    electronAPI: ElectronAPI;
    automergeRepoNetworkAdapter: AutomergeRepoNetworkAdapter;
  }
}
