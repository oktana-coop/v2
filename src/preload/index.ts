import { contextBridge, ipcRenderer } from 'electron';

import {
  type ElectronAPI,
  type MultiDocumentProjectAPI,
  type OsEventsAPI,
  type PersonalizationAPI,
  type SingleDocumentProjectAPI,
} from '../../renderer';
import {
  type OpenMultiDocumentProjectByIdArgs,
  type OpenSingleDocumentProjectStoreArgs,
  type SetupSingleDocumentProjectStoreArgs,
} from '../modules/domain/project';
import { type PromisifyEffects } from '../modules/infrastructure/cross-platform/electron-ipc-effect';
import { type UpdateState } from '../modules/infrastructure/cross-platform/update';
import {
  type CreateNewFileArgs,
  type File,
  type Filesystem as FilesystemAPI,
  type ListDirectoryFilesArgs,
  type OpenFileArgs,
} from '../modules/infrastructure/filesystem';
import type {
  FromMainMessage as AutomergeRepoNetworkFromMainIPCMessage,
  FromRendererMessage as AutomergeRepoNetworkFromRendererIPCMessage,
  ResolvedArtifactId,
} from '../modules/infrastructure/version-control';
import type {
  RunWasiCLIArgs,
  Wasm as WasmAPI,
} from '../modules/infrastructure/wasm';
import { type ResolvedTheme } from '../modules/personalization/theme';
import { registerIpcListener } from './utils';

contextBridge.exposeInMainWorld('electronAPI', {
  onReceiveProcessId: (callback: (processId: string) => void) =>
    ipcRenderer.on('renderer-process-id', (_, processId) =>
      callback(processId)
    ),
  sendCurrentDocumentId: (id: ResolvedArtifactId) =>
    ipcRenderer.send('current-document-id', id),
  openExternalLink: (url: string) =>
    ipcRenderer.send('open-external-link', url),
  clearWebStorage: () => ipcRenderer.invoke('clear-web-storage'),
  checkForUpdate: () => ipcRenderer.invoke('check-for-update'),
  onUpdateStateChange: (callback) =>
    registerIpcListener<UpdateState>('update-state', callback),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  restartToInstallUpdate: () => ipcRenderer.invoke('restart-to-install-update'),
  onToggleCommandPalette: (callback) =>
    registerIpcListener<void>('toggle-command-palette', callback),
} as ElectronAPI);

contextBridge.exposeInMainWorld('personalizationAPI', {
  setTheme: (theme) => ipcRenderer.send('set-theme', theme),
  getTheme: () => ipcRenderer.invoke('get-theme'),
  getSystemTheme: () => ipcRenderer.invoke('get-system-theme'),
  onSystemThemeUpdate: (callback) =>
    registerIpcListener<ResolvedTheme>('system-theme-update', callback),
} as PersonalizationAPI);

contextBridge.exposeInMainWorld('automergeRepoNetworkAdapter', {
  sendRendererProcessMessage: (
    message: AutomergeRepoNetworkFromRendererIPCMessage
  ) => ipcRenderer.send('automerge-repo-renderer-process-message', message),
  onReceiveMainProcessMessage: (
    callback: (message: AutomergeRepoNetworkFromMainIPCMessage) => void
  ) =>
    registerIpcListener<AutomergeRepoNetworkFromMainIPCMessage>(
      'automerge-repo-main-process-message',
      callback
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
  runWasiCLIOutputingText: (args: RunWasiCLIArgs) =>
    ipcRenderer.invoke('run-wasi-cli-outputing-text', args),
  runWasiCLIOutputingBinary: (args: RunWasiCLIArgs) =>
    ipcRenderer.invoke('run-wasi-cli-outputing-binary', args),
} as WasmAPI);

contextBridge.exposeInMainWorld('osEventsAPI', {
  onOpenFileFromFilesystem: (callback) =>
    registerIpcListener<File>('open-file-from-os', callback),
} as OsEventsAPI);
