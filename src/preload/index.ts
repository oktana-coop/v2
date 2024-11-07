import { contextBridge, ipcRenderer } from 'electron';

import { FromRendererMessage } from '../modules/version-control';
import { FromMainMessage } from '../modules/version-control/repo/electron-ipc-network-adapter/messages';

contextBridge.exposeInMainWorld('electronAPI', {
  onReceiveProcessId: (callback: (processId: string) => void) =>
    ipcRenderer.on('renderer-process-id', (_, processId) =>
      callback(processId)
    ),
});

contextBridge.exposeInMainWorld('automergeRepoNetworkAdapter', {
  sendRendererProcessMessage: (message: FromRendererMessage) =>
    ipcRenderer.send('automerge-repo-renderer-process-message', message),
  onReceiveMainProcessMessage: (callback: (message: FromMainMessage) => void) =>
    ipcRenderer.on('automerge-repo-main-process-message', (_, message) =>
      callback(message)
    ),
});
