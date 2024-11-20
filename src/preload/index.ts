import { contextBridge, ipcRenderer } from 'electron';

import type { Filesystem as FilesystemAPI } from '../modules/filesystem';
import type {
  FromMainMessage,
  FromRendererMessage,
  VersionControlId,
} from '../modules/version-control';

contextBridge.exposeInMainWorld('electronAPI', {
  onReceiveProcessId: (callback: (processId: string) => void) =>
    ipcRenderer.on('renderer-process-id', (_, processId) =>
      callback(processId)
    ),
  sendCurrentDocumentId: (id: VersionControlId) =>
    ipcRenderer.send('current-document-id', id),
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
  getDirectory: (path: string) => ipcRenderer.invoke('get-directory', path),
  listDirectoryFiles: (path: string) =>
    ipcRenderer.invoke('list-directory-files', path),
  requestPermissionForDirectory: (path: string) =>
    ipcRenderer.invoke('request-permission-for-directory', path),
  createNewFile: () => ipcRenderer.invoke('create-new-file'),
  writeFile: (path: string, content: string) =>
    ipcRenderer.invoke('write-file', { path, content }),
  readFile: (path: string) => ipcRenderer.invoke('read-file', path),
} as FilesystemAPI);

contextBridge.exposeInMainWorld('versionControlAPI', {
  createProject: ({ directoryPath }: { directoryPath: string }) =>
    ipcRenderer.invoke('create-project', { directoryPath }),
  openProject: ({
    projectId,
    directoryPath,
  }: {
    projectId: VersionControlId;
    directoryPath: string;
  }) => ipcRenderer.invoke('open-project', { projectId, directoryPath }),
});
