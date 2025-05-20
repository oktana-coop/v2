import { contextBridge, ipcRenderer } from 'electron';

import { ErrorRegistry, invokeEffect } from '../modules/electron/ipc-effect';
import {
  errorRegistry,
  type Filesystem as FilesystemAPI,
  FilesystemError,
  RepositoryError as FilesystemRepositoryError,
} from '../modules/filesystem';
import type {
  FromMainMessage,
  FromRendererMessage,
  VersionControlId,
} from '../modules/version-control';
import type { RunWasiCLIArgs, Wasm as WasmAPI } from '../modules/wasm';

contextBridge.exposeInMainWorld('electronAPI', {
  onReceiveProcessId: (callback: (processId: string) => void) =>
    ipcRenderer.on('renderer-process-id', (_, processId) =>
      callback(processId)
    ),
  sendCurrentDocumentId: (id: VersionControlId) =>
    ipcRenderer.send('current-document-id', id),
  openExternalLink: (url: string) =>
    ipcRenderer.send('open-external-link', url),
});

contextBridge.exposeInMainWorld('automergeRepoNetworkAdapter', {
  sendRendererProcessMessage: (message: FromRendererMessage) =>
    ipcRenderer.send('automerge-repo-renderer-process-message', message),
  onReceiveMainProcessMessage: (callback: (message: FromMainMessage) => void) =>
    ipcRenderer.on('automerge-repo-main-process-message', (_, message) =>
      callback(message)
    ),
});

// TODO: Use an IPC bridge that propagates typed error properly
contextBridge.exposeInMainWorld('filesystemAPI', {
  openDirectory: () =>
    invokeEffect(
      errorRegistry as ErrorRegistry<FilesystemError>,
      FilesystemRepositoryError
    )('open-directory'),
  getDirectory: (path: string) =>
    invokeEffect(
      errorRegistry as ErrorRegistry<FilesystemError>,
      FilesystemRepositoryError
    )('get-directory', path),
  listDirectoryFiles: (path: string) =>
    invokeEffect(
      errorRegistry as ErrorRegistry<FilesystemError>,
      FilesystemRepositoryError
    )('list-directory-files', path),
  requestPermissionForDirectory: (path: string) =>
    invokeEffect(
      errorRegistry as ErrorRegistry<FilesystemError>,
      FilesystemRepositoryError
    )('request-permission-for-directory', path),
  assertWritePermissionForDirectory: (path: string) =>
    invokeEffect(
      errorRegistry as ErrorRegistry<FilesystemError>,
      FilesystemRepositoryError
    )('assert-write-permission-for-directory', path),
  createNewFile: (suggestedName: string) =>
    invokeEffect(
      errorRegistry as ErrorRegistry<FilesystemError>,
      FilesystemRepositoryError
    )('create-new-file', suggestedName),
  writeFile: (path: string, content: string) =>
    invokeEffect(
      errorRegistry as ErrorRegistry<FilesystemError>,
      FilesystemRepositoryError
    )('write-file', { path, content }),
  readFile: (path: string) =>
    invokeEffect(
      errorRegistry as ErrorRegistry<FilesystemError>,
      FilesystemRepositoryError
    )('read-file', path),
} as FilesystemAPI);

contextBridge.exposeInMainWorld('versionControlAPI', {
  openOrCreateProject: ({ directoryPath }: { directoryPath: string }) =>
    ipcRenderer.invoke('open-or-create-project', { directoryPath }),
  openProject: ({
    projectId,
    directoryPath,
  }: {
    projectId: VersionControlId;
    directoryPath: string;
  }) => ipcRenderer.invoke('open-project', { projectId, directoryPath }),
});

contextBridge.exposeInMainWorld('wasmAPI', {
  runWasiCLI: (args: RunWasiCLIArgs) =>
    ipcRenderer.invoke('run-wasi-cli', args),
} as WasmAPI);
