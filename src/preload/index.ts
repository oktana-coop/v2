import * as Effect from 'effect/Effect';
import { contextBridge, ipcRenderer } from 'electron';

import {
  type Filesystem as FilesystemAPI,
  RepositoryError as FilesystemRepositoryError,
} from '../modules/filesystem';
import type {
  FromMainMessage,
  FromRendererMessage,
  VersionControlId,
} from '../modules/version-control';
import type { RunWasiCLIArgs, Wasm as WasmAPI } from '../modules/wasm';
import { mapErrorTo } from '../utils/errors';

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

contextBridge.exposeInMainWorld('filesystemAPI', {
  openDirectory: () =>
    Effect.tryPromise({
      try: () => ipcRenderer.invoke('open-directory'),
      catch: mapErrorTo(FilesystemRepositoryError, 'Electron IPC error'),
    }),
  getDirectory: (path: string) =>
    Effect.tryPromise({
      try: () => ipcRenderer.invoke('get-directory', path),
      catch: mapErrorTo(FilesystemRepositoryError, 'Electron IPC error'),
    }),
  listDirectoryFiles: (path: string) =>
    Effect.tryPromise({
      try: () => ipcRenderer.invoke('list-directory-files', path),
      catch: mapErrorTo(FilesystemRepositoryError, 'Electron IPC error'),
    }),
  requestPermissionForDirectory: (path: string) =>
    Effect.tryPromise({
      try: () => ipcRenderer.invoke('request-permission-for-directory', path),
      catch: mapErrorTo(FilesystemRepositoryError, 'Electron IPC error'),
    }),
  assertWritePermissionForDirectory: (path: string) =>
    Effect.tryPromise({
      try: () =>
        ipcRenderer.invoke('assert-write-permission-for-directory', path),
      catch: mapErrorTo(FilesystemRepositoryError, 'Electron IPC error'),
    }),
  createNewFile: (suggestedName: string) =>
    Effect.tryPromise({
      try: () => ipcRenderer.invoke('create-new-file', suggestedName),
      catch: mapErrorTo(FilesystemRepositoryError, 'Electron IPC error'),
    }),
  writeFile: (path: string, content: string) =>
    Effect.tryPromise({
      try: () => ipcRenderer.invoke('write-file', { path, content }),
      catch: mapErrorTo(FilesystemRepositoryError, 'Electron IPC error'),
    }),
  readFile: (path: string) =>
    Effect.tryPromise({
      try: () => ipcRenderer.invoke('read-file', path),
      catch: mapErrorTo(FilesystemRepositoryError, 'Electron IPC error'),
    }),
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
