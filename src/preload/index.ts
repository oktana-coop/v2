import { contextBridge, ipcRenderer } from 'electron';

import {
  MultiDocumentProjectAPI,
  type SingleDocumentProjectAPI,
} from '../../renderer';
import {
  type OpenMultiDocumentProjectByIdArgs,
  type OpenSingleDocumentProjectStoreArgs,
  type SetupSingleDocumentProjectStoreArgs,
} from '../modules/domain/project';
import { type PromisifyEffects } from '../modules/infrastructure/cross-platform/electron-ipc-effect';
import {
  type CreateNewFileArgs,
  type Filesystem as FilesystemAPI,
  type ListDirectoryFilesArgs,
  type OpenFileArgs,
} from '../modules/infrastructure/filesystem';
import type {
  IPCMessage as AutomergeRepoNetworkIPCMessage,
  VersionControlId,
} from '../modules/infrastructure/version-control';
import type {
  RunWasiCLIArgs,
  Wasm as WasmAPI,
} from '../modules/infrastructure/wasm';

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
  sendRendererProcessMessage: (message: AutomergeRepoNetworkIPCMessage) =>
    ipcRenderer.send('automerge-repo-renderer-process-message', message),
  onReceiveMainProcessMessage: (
    callback: (message: AutomergeRepoNetworkIPCMessage) => void
  ) =>
    ipcRenderer.on('automerge-repo-main-process-message', (_, message) =>
      callback(message)
    ),
});

type FilesystemPromiseAPI = PromisifyEffects<FilesystemAPI>;

contextBridge.exposeInMainWorld('filesystemAPI', {
  openDirectory: () => ipcRenderer.invoke('open-directory'),
  getDirectory: (path: string) => ipcRenderer.invoke('get-directory', path),
  listDirectoryFiles: (args: ListDirectoryFilesArgs) =>
    ipcRenderer.invoke('list-directory-files', { ...args }),
  requestPermissionForDirectory: (path: string) =>
    ipcRenderer.invoke('request-permission-for-directory', path),
  createNewFile: (args: CreateNewFileArgs) =>
    ipcRenderer.invoke('create-new-file', { ...args }),
  openFile: (args: OpenFileArgs) =>
    ipcRenderer.invoke('open-file', { ...args }),
  writeFile: (path: string, content: string) =>
    ipcRenderer.invoke('write-file', { path, content }),
  readFile: (path: string) => ipcRenderer.invoke('read-file', path),
} as FilesystemPromiseAPI);

contextBridge.exposeInMainWorld('singleDocumentProjectAPI', {
  createSingleDocumentProject: (args: SetupSingleDocumentProjectStoreArgs) =>
    ipcRenderer.invoke('create-single-document-project', { ...args }),
  openSingleDocumentProject: (args: OpenSingleDocumentProjectStoreArgs) =>
    ipcRenderer.invoke('open-single-document-project', { ...args }),
} as SingleDocumentProjectAPI);

contextBridge.exposeInMainWorld('multiDocumentProjectAPI', {
  openOrCreateMultiDocumentProject: () =>
    ipcRenderer.invoke('open-or-create-multi-document-project'),
  openMultiDocumentProjectById: (args: OpenMultiDocumentProjectByIdArgs) =>
    ipcRenderer.invoke('open-multi-document-project-by-id', { ...args }),
} as MultiDocumentProjectAPI);

contextBridge.exposeInMainWorld('wasmAPI', {
  runWasiCLI: (args: RunWasiCLIArgs) =>
    ipcRenderer.invoke('run-wasi-cli', args),
} as WasmAPI);
