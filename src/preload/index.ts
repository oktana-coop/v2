import { contextBridge, ipcRenderer } from 'electron';

import {
  type AuthAPI,
  type ElectronAPI,
  type FilesystemPromiseAPI,
  type PersonalizationAPI,
  type ProjectStoreManagerAPI,
  type ProjectStorePromiseAPI,
  type RendererConfig,
  type VersionControlSyncProvidersAPI,
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
  type GetRenamedPathArgs,
  type ListDirectoryFilesArgs,
  type ListDirectoryTreeArgs,
  type OpenFileArgs,
  type RenameArgs,
  type WriteFileArgs,
} from '../modules/infrastructure/filesystem';
import type { ArtifactId } from '../modules/infrastructure/version-control';
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
  sendCurrentDocumentId: (id: ArtifactId) =>
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
  primaryRichTextRepresentation: buildConfig.primaryRichTextRepresentation,
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

contextBridge.exposeInMainWorld('projectStoreAPI', {
  createProject: (args) =>
    ipcRenderer.invoke('project-store:create-project', {
      ...args,
    }),
  findProjectById: (id) =>
    ipcRenderer.invoke('project-store:find-project-by-id', id),
  listProjectDocuments: (id) =>
    ipcRenderer.invoke('project-store:list-project-documents', id),
  getProjectTree: (id) =>
    ipcRenderer.invoke('project-store:get-project-tree', id),
  createDirectory: (args) =>
    ipcRenderer.invoke('project-store:create-directory', { ...args }),
  deleteDirectory: (args) =>
    ipcRenderer.invoke('project-store:delete-directory', { ...args }),
  getArtifactPathById: (args) =>
    ipcRenderer.invoke('project-store:get-artifact-path-by-id', { ...args }),
  lookupArtifactByPath: (args) =>
    ipcRenderer.invoke('project-store:lookup-artifact-by-path', { ...args }),
  deleteDocuments: (args) =>
    ipcRenderer.invoke('project-store:delete-documents', {
      ...args,
    }),
  renameDocumentInProject: (args) =>
    ipcRenderer.invoke('project-store:rename-document-in-project', { ...args }),
  renameDirectory: (args) =>
    ipcRenderer.invoke('project-store:rename-directory', { ...args }),
  lookupDocumentInProject: (args) =>
    ipcRenderer.invoke('project-store:lookup-document-in-project', { ...args }),
  findDocumentByPath: (args) =>
    ipcRenderer.invoke('project-store:find-document-by-path', { ...args }),
  addAssetToProject: (args) =>
    ipcRenderer.invoke('project-store:add-asset-to-project', {
      ...args,
    }),
  lookupAssetByName: (args) =>
    ipcRenderer.invoke('project-store:lookup-asset-by-name', {
      ...args,
    }),
  getProjectRelativePath: (args) =>
    ipcRenderer.invoke('project-store:get-project-relative-path', { ...args }),
  readDocumentReferencedAssets: (args) =>
    ipcRenderer.invoke('project-store:read-document-referenced-assets', {
      ...args,
    }),
  commitChanges: (args) =>
    ipcRenderer.invoke('project-store:commit-changes', {
      ...args,
    }),
  commitDocumentChanges: (args) =>
    ipcRenderer.invoke('project-store:commit-document-changes', {
      ...args,
    }),
  restoreDocumentChanges: (args) =>
    ipcRenderer.invoke('project-store:restore-document-changes', { ...args }),
  createAndSwitchToBranch: (args) =>
    ipcRenderer.invoke('project-store:create-and-switch-to-branch', {
      ...args,
    }),
  switchToBranch: (args) =>
    ipcRenderer.invoke('project-store:switch-to-branch', {
      ...args,
    }),
  getCurrentBranch: (args) =>
    ipcRenderer.invoke('project-store:get-current-branch', {
      ...args,
    }),
  listBranches: (args) =>
    ipcRenderer.invoke('project-store:list-branches', {
      ...args,
    }),
  deleteBranch: (args) =>
    ipcRenderer.invoke('project-store:delete-branch', {
      ...args,
    }),
  mergeAndDeleteBranch: (args) =>
    ipcRenderer.invoke('project-store:merge-and-delete-branch', {
      ...args,
    }),
  getMergeConflictInfo: (args) =>
    ipcRenderer.invoke('project-store:get-merge-conflict-info', {
      ...args,
    }),
  abortMerge: (args) =>
    ipcRenderer.invoke('project-store:abort-merge', {
      ...args,
    }),
  commitMergeConflictsResolution: (args) =>
    ipcRenderer.invoke('project-store:commit-merge-conflicts-resolution', {
      ...args,
    }),
  resolveConflictByKeepingDocument: (args) =>
    ipcRenderer.invoke('project-store:resolve-conflict-by-keeping-document', {
      ...args,
    }),
  resolveConflictByDeletingDocument: (args) =>
    ipcRenderer.invoke('project-store:resolve-conflict-by-deleting-document', {
      ...args,
    }),
  setAuthorInfo: (args) =>
    ipcRenderer.invoke('project-store:set-author-info', {
      ...args,
    }),
  addRemoteProject: (args) =>
    ipcRenderer.invoke('project-store:add-remote-project', {
      ...args,
    }),
  listRemoteProjects: (args) =>
    ipcRenderer.invoke('project-store:list-remote-projects', {
      ...args,
    }),
  findRemoteProjectByName: (args) =>
    ipcRenderer.invoke('project-store:find-remote-project-by-name', {
      ...args,
    }),
  pushToRemoteProject: (args) =>
    ipcRenderer.invoke('project-store:push-to-remote-project', {
      ...args,
    }),
  pullFromRemoteProject: (args) =>
    ipcRenderer.invoke('project-store:pull-from-remote-project', {
      ...args,
    }),
  getRemoteBranchInfo: (args) =>
    ipcRenderer.invoke('project-store:get-remote-branch-info', {
      ...args,
    }),
  getProjectCommitHistory: (args) =>
    ipcRenderer.invoke('project-store:get-project-commit-history', {
      ...args,
    }),
  getChangedDocumentsAtChange: (args) =>
    ipcRenderer.invoke('project-store:get-changed-documents-at-change', {
      ...args,
    }),
  createDocument: (args) =>
    ipcRenderer.invoke('project-store:create-document', { ...args }),
  findDocumentById: (args) =>
    ipcRenderer.invoke('project-store:find-document-by-id', {
      ...args,
    }),
  getDocumentLastChangeId: (args) =>
    ipcRenderer.invoke('project-store:get-document-last-change-id', {
      ...args,
    }),
  updateRichTextDocumentContent: (args) =>
    ipcRenderer.invoke('project-store:update-rich-text-document-content', {
      ...args,
    }),
  deleteDocument: (args) =>
    ipcRenderer.invoke('project-store:delete-document', { ...args }),
  getDocumentHistory: (args) =>
    ipcRenderer.invoke('project-store:get-document-history', {
      ...args,
    }),
  getDocumentAtChange: (args) =>
    ipcRenderer.invoke('project-store:get-document-at-change', {
      ...args,
    }),
  isContentSameAtChanges: (args) =>
    ipcRenderer.invoke('project-store:is-content-same-at-changes', {
      ...args,
    }),
  discardUncommittedChanges: (args) =>
    ipcRenderer.invoke('project-store:discard-uncommitted-changes', {
      ...args,
    }),
  resolveContentConflict: (args) =>
    ipcRenderer.invoke('project-store:resolve-content-conflict', {
      ...args,
    }),
} as ProjectStorePromiseAPI);

// TODO: Namespace IPC messages
contextBridge.exposeInMainWorld('projectStoreManagerAPI', {
  openOrCreateProject: (args) =>
    ipcRenderer.invoke('open-or-create-project', { ...args }),
  openProjectById: (args) =>
    ipcRenderer.invoke('open-project-by-id', { ...args }),
} as ProjectStoreManagerAPI);

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
