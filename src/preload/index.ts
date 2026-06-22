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
  type VersionControlSyncProvidersAPI,
  type VersionedDocumentStorePromiseAPI,
} from '../../renderer';
import { type GithubDeviceFlowVerificationInfo } from '../modules/auth';
import { buildConfig } from '../modules/config';
import {
  type ContextMenuAction,
  type ContextMenuPayload,
  PDF_IPC_CHANNEL,
} from '../modules/infrastructure/cross-platform';
import {
  isLinux,
  isMac,
  isWindows,
  type UpdateState,
} from '../modules/infrastructure/cross-platform/node';
import {
  type CreateDirectoryArgs,
  type CreateNewFileArgs,
  type DeleteDirectoryArgs,
  type DeleteFileArgs,
  type File,
  type GetRenamedPathArgs,
  type ListDirectoryFilesArgs,
  type ListDirectoryTreeArgs,
  type OpenFileArgs,
  type RenameArgs,
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
import {
  type EditorAppearancePreferences,
  type ExportTemplatePreferences,
  type ResolvedTheme,
  type UIAppearancePreferences,
} from '../modules/personalization';
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
  showContextMenu: (payload: ContextMenuPayload) =>
    ipcRenderer.invoke('context-menu:show', payload),
  onContextMenuAction: (callback) =>
    registerIpcListener<ContextMenuAction>('context-menu:action', callback),
  printToPDF: (args: { html: string; stylesheet?: string }) =>
    ipcRenderer.invoke(PDF_IPC_CHANNEL, args),
} as ElectronAPI);

contextBridge.exposeInMainWorld('config', {
  useHistoryWorker: buildConfig.useHistoryWorker,
  multiDocumentProjectVersionControlSystem:
    buildConfig.multiDocumentProjectVersionControlSystem,
} as RendererConfig);

contextBridge.exposeInMainWorld('personalizationAPI', {
  setTheme: (theme) => ipcRenderer.send('set-theme', theme),
  getTheme: () => ipcRenderer.invoke('get-theme'),
  getSystemTheme: () => ipcRenderer.invoke('get-system-theme'),
  onSystemThemeUpdate: (callback) =>
    registerIpcListener<ResolvedTheme>('system-theme-update', callback),
  setUIAppearance: (uiAppearance: UIAppearancePreferences) =>
    ipcRenderer.invoke('set-ui-appearance', uiAppearance),
  getUIAppearance: () => ipcRenderer.invoke('get-ui-appearance'),
  setEditorAppearance: (editorAppearance: EditorAppearancePreferences) =>
    ipcRenderer.invoke('set-editor-appearance', editorAppearance),
  getEditorAppearance: () => ipcRenderer.invoke('get-editor-appearance'),
  setExportTemplates: (exportTemplates: ExportTemplatePreferences) =>
    ipcRenderer.invoke('set-export-templates', exportTemplates),
  getExportTemplates: () => ipcRenderer.invoke('get-export-templates'),
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
  listDirectoryTree: (args: ListDirectoryTreeArgs) =>
    ipcRenderer.invoke('list-directory-tree', { ...args }),
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
  deleteDirectory: (args: DeleteDirectoryArgs) =>
    ipcRenderer.invoke('delete-directory', { ...args }),
  rename: (args: RenameArgs) => ipcRenderer.invoke('rename', { ...args }),
  createDirectory: (args: CreateDirectoryArgs) =>
    ipcRenderer.invoke('create-directory', { ...args }),
  ensureDirectory: (args) =>
    ipcRenderer.invoke('ensure-directory', { ...args }),
  getRelativePath: (args) =>
    ipcRenderer.invoke('get-relative-path', { ...args }),
  getAbsolutePath: (args) =>
    ipcRenderer.invoke('get-absolute-path', { ...args }),
  getRenamedPath: (args: GetRenamedPathArgs) =>
    ipcRenderer.invoke('get-renamed-path', { ...args }),
  isDescendantPath: (args) =>
    ipcRenderer.invoke('is-descendant-path', { ...args }),
  exists: (path: string) => ipcRenderer.invoke('file-exists', path),
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
  deleteDocument: (args, projectId) =>
    ipcRenderer.invoke(
      'versioned-document-store:delete-document',
      args,
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
  deleteDocumentsFromProject: (args) =>
    ipcRenderer.invoke(
      'multi-document-project-store:delete-documents-from-project',
      { ...args }
    ),
  renameDocumentInProject: (args) =>
    ipcRenderer.invoke(
      'multi-document-project-store:rename-document-in-project',
      { ...args }
    ),
  renameDocumentsInProject: (args) =>
    ipcRenderer.invoke(
      'multi-document-project-store:rename-documents-in-project',
      { ...args }
    ),
  findDocumentInProject: (args) =>
    ipcRenderer.invoke(
      'multi-document-project-store:find-document-in-project',
      { ...args }
    ),
  addAssetToProject: (args) =>
    ipcRenderer.invoke('multi-document-project-store:add-asset-to-project', {
      ...args,
    }),
  lookupAssetByName: (args) =>
    ipcRenderer.invoke('multi-document-project-store:lookup-asset-by-name', {
      ...args,
    }),
  getProjectRelativePath: (args) =>
    ipcRenderer.invoke(
      'multi-document-project-store:get-project-relative-path',
      { ...args }
    ),
  readDocumentReferencedAssets: (args) =>
    ipcRenderer.invoke(
      'multi-document-project-store:read-document-referenced-assets',
      { ...args }
    ),
  commitChanges: (args) =>
    ipcRenderer.invoke('multi-document-project-store:commit-changes', {
      ...args,
    }),
  commitDocumentChanges: (args) =>
    ipcRenderer.invoke('multi-document-project-store:commit-document-changes', {
      ...args,
    }),
  restoreDocumentChanges: (args) =>
    ipcRenderer.invoke(
      'multi-document-project-store:restore-document-changes',
      { ...args }
    ),
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
  commitMergeConflictsResolution: (args) =>
    ipcRenderer.invoke(
      'multi-document-project-store:commit-merge-conflicts-resolution',
      {
        ...args,
      }
    ),
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
  getProjectCommitHistory: (args) =>
    ipcRenderer.invoke(
      'multi-document-project-store:get-project-commit-history',
      {
        ...args,
      }
    ),
  getChangedDocumentsAtChange: (args) =>
    ipcRenderer.invoke(
      'multi-document-project-store:get-changed-documents-at-change',
      {
        ...args,
      }
    ),
} as MultiDocumentProjectStorePromiseAPI);

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
