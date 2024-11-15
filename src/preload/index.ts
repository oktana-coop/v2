import { contextBridge, ipcRenderer } from 'electron';

import type { Filesystem as FilesystemAPI } from '../modules/filesystem';
import type {
  FromMainMessage,
  FromRendererMessage,
} from '../modules/version-control';

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

contextBridge.exposeInMainWorld('filesystemAPI', {
  openDirectory: () => ipcRenderer.invoke('open-directory'),
  getDirectory: () => ipcRenderer.invoke('get-directory'),
  listDirectoryFiles: () => ipcRenderer.invoke('list-directory-files'),
  requestPermissionForDirectory: () =>
    ipcRenderer.invoke('request-permission-for-directory'),
  createNewFile: () => ipcRenderer.invoke('create-new-file'),
  writeFile: () => ipcRenderer.invoke('write-file'),
  readFile: () => ipcRenderer.invoke('read-file'),
} as FilesystemAPI);
