import { contextBridge, ipcRenderer } from 'electron';

import {
  type AuthAPI,
  type ElectronAPI,
  type FilesystemPromiseAPI,
  type MultiDocumentProjectStoreManagerAPI,
  type MultiDocumentProjectStorePromiseAPI,
  type OsEventsAPI,
  type PersonalizationAPI,
  type RendererConfig,
  type SingleDocumentProjectStoreManagerAPI,
  type SingleDocumentProjectStorePromiseAPI,
  type VersionControlSyncProvidersAPI,
  type VersionedDocumentStorePromiseAPI,
} from '../../renderer';
import { type GithubDeviceFlowVerificationInfo } from '../modules/auth';
import { buildConfig } from '../modules/config';
import {
  isLinux,
  isMac,
  isWindows,
  type UpdateState,
} from '../modules/infrastructure/cross-platform/node';
import {
  type CreateNewFileArgs,
  type DeleteFileArgs,
  type File,
  type ListDirectoryFilesArgs,
  type OpenFileArgs,
  type WriteFileArgs,
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
  isMac: isMac(),
  isWindows: isWindows(),
  isLinux: isLinux(),
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

contextBridge.exposeInMainWorld('config', {
  useHistoryWorker: buildConfig.useHistoryWorker,
  singleDocumentProjectVersionControlSystem:
    buildConfig.singleDocumentProjectVersionControlSystem,
  multiDocumentProjectVersionControlSystem:
    buildConfig.multiDocumentProjectVersionControlSystem,
  projectType: buildConfig.projectType,
} as RendererConfig);

contextBridge.exposeInMainWorld('personalizationAPI', {
  setTheme: (theme) => ipcRenderer.send('set-theme', theme),
  getTheme: () => ipcRenderer.invoke('get-theme'),
  getSystemTheme: () => ipcRenderer.invoke('get-system-theme'),
  onSystemThemeUpdate: (callback) =>
    registerIpcListener<ResolvedTheme>('system-theme-update', callback),
} as PersonalizationAPI);

contextBridge.exposeInMainWorld('authAPI', {
  setUsername: (username) => ipcRenderer.send('auth:set-username', username),
  setEmail: (email) => ipcRenderer.send('auth:set-email', email),
  getInfo: () => ipcRenderer.invoke('auth:get-info'),
  githubAuthUsingDeviceFlow: () =>
    ipcRenderer.invoke('auth:github-device-flow'),
  onDeviceVerificationInfoAvailable: (callback) =>
    registerIpcListener<GithubDeviceFlowVerificationInfo>(
      'auth:github-device-flow-verification-info',
      callback
    ),
  cancelGithubDeviceFlowAuth: () =>
    ipcRenderer.invoke('auth:cancel-github-device-flow'),
  disconnectFromGithub: () => ipcRenderer.invoke('auth:disconnect-from-github'),
} as AuthAPI);

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

contextBridge.exposeInMainWorld('filesystemAPI', {
  openDirectory: () => ipcRenderer.invoke('open-directory'),
  getDirectory: (path: string) => ipcRenderer.invoke('get-directory', path),
  listDirectoryFiles: (args: ListDirectoryFilesArgs) =>
    ipcRenderer.invoke('list-directory-files', { ...args }),
  requestPermissionForDirectory: (path: string) =>
    ipcRenderer.invoke('request-permission-for-directory', path),
  assertWritePermissionForDirectory: (path: string) =>
    ipcRenderer.invoke('assert-write-permission-for-directory', path),
  createNewFile: (args: CreateNewFileArgs) =>
    ipcRenderer.invoke('create-new-file', { ...args }),
  openFile: (args: OpenFileArgs) =>
    ipcRenderer.invoke('open-file', { ...args }),
  writeFile: (args: WriteFileArgs) =>
    ipcRenderer.invoke('write-file', { ...args }),
  readBinaryFile: (path: string) =>
    ipcRenderer.invoke('read-binary-file', path),
  readTextFile: (path: string) => ipcRenderer.invoke('read-text-file', path),
  deleteFile: (args: DeleteFileArgs) =>
    ipcRenderer.invoke('delete-file', { ...args }),
  getRelativePath: (args) =>
    ipcRenderer.invoke('get-relative-path', { ...args }),
  getAbsolutePath: (args) =>
    ipcRenderer.invoke('get-absolute-path', { ...args }),
} as FilesystemPromiseAPI);

contextBridge.exposeInMainWorld('versionedDocumentStoreAPI', {
  setProjectId: (id) =>
    ipcRenderer.invoke('versioned-document-store:set-project-id', id),
  createDocument: (args, projectId) =>
    ipcRenderer.invoke(
      'versioned-document-store:create-document',
      { ...args },
      projectId
    ),
  findDocumentById: (id, projectId) =>
    ipcRenderer.invoke(
      'versioned-document-store:find-document-by-id',
      id,
      projectId
    ),
  getDocumentLastChangeId: (id, projectId) =>
    ipcRenderer.invoke(
      'versioned-document-store:get-document-last-change-id',
      id,
      projectId
    ),
  updateRichTextDocumentContent: (args, projectId) =>
    ipcRenderer.invoke(
      'versioned-document-store:update-rich-text-document-content',
      { ...args },
      projectId
    ),
  deleteDocument: (id, projectId) =>
    ipcRenderer.invoke(
      'versioned-document-store:delete-document',
      id,
      projectId
    ),
  commitChanges: (args, projectId) =>
    ipcRenderer.invoke(
      'versioned-document-store:commit-changes',
      { ...args },
      projectId
    ),
  getDocumentHistory: (id, projectId) =>
    ipcRenderer.invoke(
      'versioned-document-store:get-document-history',
      id,
      projectId
    ),
  getDocumentAtChange: (args, projectId) =>
    ipcRenderer.invoke(
      'versioned-document-store:get-document-at-change',
      {
        ...args,
      },
      projectId
    ),
  isContentSameAtChanges: (args, projectId) =>
    ipcRenderer.invoke(
      'versioned-document-store:is-content-same-at-changes',
      {
        ...args,
      },
      projectId
    ),
  restoreCommit: (args, projectId) =>
    ipcRenderer.invoke(
      'versioned-document-store:restore-commit',
      {
        ...args,
      },
      projectId
    ),
  discardUncommittedChanges: (args, projectId) =>
    ipcRenderer.invoke(
      'versioned-document-store:discard-uncommitted-changes',
      {
        ...args,
      },
      projectId
    ),
  resolveContentConflict: (args, projectId) =>
    ipcRenderer.invoke(
      'versioned-document-store:resolve-content-conflict',
      {
        ...args,
      },
      projectId
    ),
  disconnect: (projectId) =>
    ipcRenderer.invoke('versioned-document-store:disconnect', projectId),
} as VersionedDocumentStorePromiseAPI);

contextBridge.exposeInMainWorld('singleDocumentProjectStoreAPI', {
  createSingleDocumentProject: (args, projectId) =>
    ipcRenderer.invoke(
      'single-document-project-store:create-single-document-project',
      {
        ...args,
      },
      projectId
    ),
  findDocumentInProject: (id) =>
    ipcRenderer.invoke(
      'single-document-project-store:find-document-in-project',
      id
    ),
  findProjectById: (id) =>
    ipcRenderer.invoke('single-document-project-store:find-project-by-id', id),
  getProjectName: (id) =>
    ipcRenderer.invoke('single-document-project-store:get-project-name', id),
  createAndSwitchToBranch: (args) =>
    ipcRenderer.invoke(
      'single-document-project-store:create-and-switch-to-branch',
      {
        ...args,
      }
    ),
  switchToBranch: (args) =>
    ipcRenderer.invoke('single-document-project-store:switch-to-branch', {
      ...args,
    }),
  getCurrentBranch: (args) =>
    ipcRenderer.invoke('single-document-project-store:get-current-branch', {
      ...args,
    }),
  listBranches: (args) =>
    ipcRenderer.invoke('single-document-project-store:list-branches', {
      ...args,
    }),
  deleteBranch: (args) =>
    ipcRenderer.invoke('single-document-project-store:delete-branch', {
      ...args,
    }),
  mergeAndDeleteBranch: (args) =>
    ipcRenderer.invoke(
      'single-document-project-store:merge-and-delete-branch',
      {
        ...args,
      }
    ),
  getMergeConflictInfo: (args) =>
    ipcRenderer.invoke(
      'single-document-project-store:get-merge-conflict-info',
      {
        ...args,
      }
    ),
  abortMerge: (args) =>
    ipcRenderer.invoke('single-document-project-store:abort-merge', {
      ...args,
    }),
  setAuthorInfo: (args) =>
    ipcRenderer.invoke('single-document-project-store:set-author-info', {
      ...args,
    }),
  addRemoteProject: (args) =>
    ipcRenderer.invoke('single-document-project-store:add-remote-project', {
      ...args,
    }),
  listRemoteProjects: (args) =>
    ipcRenderer.invoke('single-document-project-store:list-remote-projects', {
      ...args,
    }),
  findRemoteProjectByName: (args) =>
    ipcRenderer.invoke(
      'single-document-project-store:find-remote-project-by-name',
      {
        ...args,
      }
    ),
  pushToRemoteProject: (args) =>
    ipcRenderer.invoke('single-document-project-store:push-to-remote-project', {
      ...args,
    }),
  pullFromRemoteProject: (args) =>
    ipcRenderer.invoke(
      'single-document-project-store:pull-from-remote-project',
      {
        ...args,
      }
    ),
  getRemoteBranchInfo: (args) =>
    ipcRenderer.invoke('single-document-project-store:get-remote-branch-info', {
      ...args,
    }),
  disconnect: (projectId) =>
    ipcRenderer.invoke('single-document-project-store:disconnect', projectId),
} as SingleDocumentProjectStorePromiseAPI);

contextBridge.exposeInMainWorld('multiDocumentProjectStoreAPI', {
  createProject: (args) =>
    ipcRenderer.invoke('multi-document-project-store:create-project', {
      ...args,
    }),
  findProjectById: (id) =>
    ipcRenderer.invoke('multi-document-project-store:find-project-by-id', id),
  listProjectDocuments: (id) =>
    ipcRenderer.invoke(
      'multi-document-project-store:list-project-documents',
      id
    ),
  addDocumentToProject: (args) =>
    ipcRenderer.invoke('multi-document-project-store:add-document-to-project', {
      ...args,
    }),
  deleteDocumentFromProject: (args) =>
    ipcRenderer.invoke(
      'multi-document-project-store:delete-document-from-project',
      { ...args }
    ),
  findDocumentInProject: (args) =>
    ipcRenderer.invoke(
      'multi-document-project-store:find-document-in-project',
      { ...args }
    ),
  commitChanges: (args) =>
    ipcRenderer.invoke('multi-document-project-store:commit-changes', {
      ...args,
    }),
  createAndSwitchToBranch: (args) =>
    ipcRenderer.invoke(
      'multi-document-project-store:create-and-switch-to-branch',
      {
        ...args,
      }
    ),
  switchToBranch: (args) =>
    ipcRenderer.invoke('multi-document-project-store:switch-to-branch', {
      ...args,
    }),
  getCurrentBranch: (args) =>
    ipcRenderer.invoke('multi-document-project-store:get-current-branch', {
      ...args,
    }),
  listBranches: (args) =>
    ipcRenderer.invoke('multi-document-project-store:list-branches', {
      ...args,
    }),
  deleteBranch: (args) =>
    ipcRenderer.invoke('multi-document-project-store:delete-branch', {
      ...args,
    }),
  mergeAndDeleteBranch: (args) =>
    ipcRenderer.invoke('multi-document-project-store:merge-and-delete-branch', {
      ...args,
    }),
  getMergeConflictInfo: (args) =>
    ipcRenderer.invoke('multi-document-project-store:get-merge-conflict-info', {
      ...args,
    }),
  abortMerge: (args) =>
    ipcRenderer.invoke('multi-document-project-store:abort-merge', {
      ...args,
    }),
  resolveConflictByKeepingDocument: (args) =>
    ipcRenderer.invoke(
      'multi-document-project-store:resolve-conflict-by-keeping-document',
      {
        ...args,
      }
    ),
  resolveConflictByDeletingDocument: (args) =>
    ipcRenderer.invoke(
      'multi-document-project-store:resolve-conflict-by-deleting-document',
      {
        ...args,
      }
    ),
  setAuthorInfo: (args) =>
    ipcRenderer.invoke('multi-document-project-store:set-author-info', {
      ...args,
    }),
  addRemoteProject: (args) =>
    ipcRenderer.invoke('multi-document-project-store:add-remote-project', {
      ...args,
    }),
  listRemoteProjects: (args) =>
    ipcRenderer.invoke('multi-document-project-store:list-remote-projects', {
      ...args,
    }),
  findRemoteProjectByName: (args) =>
    ipcRenderer.invoke(
      'multi-document-project-store:find-remote-project-by-name',
      {
        ...args,
      }
    ),
  pushToRemoteProject: (args) =>
    ipcRenderer.invoke('multi-document-project-store:push-to-remote-project', {
      ...args,
    }),
  pullFromRemoteProject: (args) =>
    ipcRenderer.invoke(
      'multi-document-project-store:pull-from-remote-project',
      {
        ...args,
      }
    ),
  getRemoteBranchInfo: (args) =>
    ipcRenderer.invoke('multi-document-project-store:get-remote-branch-info', {
      ...args,
    }),
} as MultiDocumentProjectStorePromiseAPI);

// TODO: Namespace IPC messages
contextBridge.exposeInMainWorld('singleDocumentProjectStoreManagerAPI', {
  setupSingleDocumentProjectStore: (args) =>
    ipcRenderer.invoke('create-single-document-project', { ...args }),
  openSingleDocumentProjectStore: (args) =>
    ipcRenderer.invoke('open-single-document-project', { ...args }),
} as SingleDocumentProjectStoreManagerAPI);

// TODO: Namespace IPC messages
contextBridge.exposeInMainWorld('multiDocumentProjectStoreManagerAPI', {
  openOrCreateMultiDocumentProject: (args) =>
    ipcRenderer.invoke('open-or-create-multi-document-project', { ...args }),
  openMultiDocumentProjectById: (args) =>
    ipcRenderer.invoke('open-multi-document-project-by-id', { ...args }),
} as MultiDocumentProjectStoreManagerAPI);

contextBridge.exposeInMainWorld('versionControlSyncProvidersAPI', {
  getGithubUserRepositories: () =>
    ipcRenderer.invoke(
      'version-control-sync-providers:get-github-user-repositories'
    ),
} as VersionControlSyncProvidersAPI);

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
