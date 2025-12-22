import type { IpcRenderer } from 'electron';

import {
  type Email,
  type GithubUserInfo,
  type Username,
} from './src/modules/auth';
import { type RendererConfig } from './src/modules/config/browser';
import {
  type MultiDocumentProjectStore,
  type OpenMultiDocumentProjectByIdArgs,
  type OpenMultiDocumentProjectByIdResult,
  OpenOrCreateMultiDocumentProjectArgs,
  type OpenOrCreateMultiDocumentProjectResult,
  type OpenSingleDocumentProjectStoreArgs,
  type OpenSingleDocumentProjectStoreResult,
  type SetupSingleDocumentProjectStoreArgs,
  type SetupSingleDocumentProjectStoreResult,
  type SingleDocumentProjectStore,
} from './src/modules/domain/project';
import { type VersionedDocumentStore } from './src/modules/domain/rich-text';
import {
  type AppendParam,
  type PromisifyEffects,
  type UpdateState,
} from './src/modules/infrastructure/cross-platform';
import {
  type File,
  type Filesystem as FilesystemAPI,
} from './src/modules/infrastructure/filesystem';
import {
  type FromMainMessage as AutomergeRepoNetworkFromMainIPCMessage,
  type FromRendererMessage as AutomergeRepoNetworkFromRendererIPCMessage,
  GithubDeviceFlowVerificationInfo,
  type GithubRepositoryInfo,
  type ResolvedArtifactId,
} from './src/modules/infrastructure/version-control';
import { type Wasm as WasmAPI } from './src/modules/infrastructure/wasm';
import {
  type ResolvedTheme,
  type Theme,
} from './src/modules/personalization/theme';

export type UnregisterListenerFn = () => void;

export type ElectronAPI = {
  onReceiveProcessId: (callback: (processId: string) => void) => IpcRenderer;
  sendCurrentDocumentId: (id: ResolvedArtifactId) => void;
  openExternalLink: (url: string) => void;
  clearWebStorage: () => Promise<void>;
  checkForUpdate: () => Promise<void>;
  onUpdateStateChange: (
    callback: (updateState: UpdateState) => void
  ) => () => void;
  downloadUpdate: () => Promise<void>;
  restartToInstallUpdate: () => Promise<void>;
  onToggleCommandPalette: (callback: () => void) => () => void;
};

export type PersonalizationAPI = {
  setTheme: (theme: Theme) => Promise<void>;
  getTheme: () => Promise<Theme>;
  getSystemTheme: () => Promise<Exclude<Theme, 'system'>>;
  onSystemThemeUpdate: (callback: (theme: ResolvedTheme) => void) => () => void;
};

export type AuthAPI = {
  setUsername: (username: Username | null) => Promise<void>;
  setEmail: (email: Email | null) => Promise<void>;
  getInfo: () => Promise<{
    username: Username | null;
    email: Email | null;
    githubUserInfo: GithubUserInfo | null;
  }>;
  githubAuthUsingDeviceFlow: () => Promise<GithubUserInfo>;
  onDeviceVerificationInfoAvailable: (
    callback: (verificationInfo: GithubDeviceFlowVerificationInfo) => void
  ) => UnregisterListenerFn;
  cancelGithubDeviceFlowAuth: () => Promise<void>;
  disconnectFromGithub: () => Promise<void>;
};

export type AutomergeRepoNetworkAdapter = {
  sendRendererProcessMessage: (
    message: AutomergeRepoNetworkFromRendererIPCMessage
  ) => void;
  onReceiveMainProcessMessage: (
    callback: (message: AutomergeRepoNetworkFromMainIPCMessage) => void
  ) => UnregisterListenerFn;
};

export type SingleDocumentProjectStoreManagerAPI = {
  setupSingleDocumentProjectStore: (
    args: SetupSingleDocumentProjectStoreArgs
  ) => Promise<
    Pick<
      SetupSingleDocumentProjectStoreResult,
      'projectId' | 'documentId' | 'currentBranch' | 'file' | 'name'
    >
  >;
  openSingleDocumentProjectStore: (
    args: OpenSingleDocumentProjectStoreArgs
  ) => Promise<
    Pick<
      OpenSingleDocumentProjectStoreResult,
      'projectId' | 'documentId' | 'currentBranch' | 'file' | 'name'
    >
  >;
};

export type MultiDocumentProjectStoreManagerAPI = {
  openOrCreateMultiDocumentProject: (
    args: OpenOrCreateMultiDocumentProjectArgs
  ) => Promise<
    Pick<
      OpenOrCreateMultiDocumentProjectResult,
      'projectId' | 'directory' | 'currentBranch'
    >
  >;
  openMultiDocumentProjectById: (
    args: OpenMultiDocumentProjectByIdArgs
  ) => Promise<
    Pick<OpenMultiDocumentProjectByIdResult, 'directory' | 'currentBranch'>
  >;
};

export type FilesystemPromiseAPI = PromisifyEffects<FilesystemAPI>;

export type MultiDocumentProjectStorePromiseAPI =
  PromisifyEffects<MultiDocumentProjectStore>;

export type SingleDocumentProjectStoreIPCAPI = SingleDocumentProjectStore & {
  createSingleDocumentProject: AppendParam<
    SingleDocumentProjectStore['createSingleDocumentProject'],
    string
  >;
  disconnect: AppendParam<SingleDocumentProjectStore['disconnect'], string>;
};

export type SingleDocumentProjectStorePromiseAPI =
  PromisifyEffects<SingleDocumentProjectStoreIPCAPI>;

type VersionedDocumentStoreIPCAPI = VersionedDocumentStore & {
  createDocument: AppendParam<VersionedDocumentStore['createDocument'], string>;
  findDocumentById: AppendParam<
    VersionedDocumentStore['findDocumentById'],
    string
  >;
  getDocumentLastChangeId: AppendParam<
    VersionedDocumentStore['getDocumentLastChangeId'],
    string
  >;
  updateRichTextDocumentContent: AppendParam<
    VersionedDocumentStore['updateRichTextDocumentContent'],
    string
  >;
  deleteDocument: AppendParam<VersionedDocumentStore['deleteDocument'], string>;
  commitChanges: AppendParam<VersionedDocumentStore['commitChanges'], string>;
  getDocumentHistory: AppendParam<
    VersionedDocumentStore['getDocumentHistory'],
    string
  >;
  getDocumentAtChange: AppendParam<
    VersionedDocumentStore['getDocumentAtChange'],
    string
  >;
  isContentSameAtChanges: AppendParam<
    VersionedDocumentStore['isContentSameAtChanges'],
    string
  >;
  restoreCommit: AppendParam<VersionedDocumentStore['restoreCommit'], string>;
  discardUncommittedChanges: AppendParam<
    VersionedDocumentStore['discardUncommittedChanges'],
    string
  >;
  disconnect: AppendParam<VersionedDocumentStore['disconnect'], string>;
};

export type VersionedDocumentStorePromiseAPI =
  PromisifyEffects<VersionedDocumentStoreIPCAPI>;

export type OsEventsAPI = {
  onOpenFileFromFilesystem: (callback: (file: File) => void) => () => void;
};

export type VersionControlSyncProvidersAPI = {
  getGithubUserRepositories: () => Promise<GithubRepositoryInfo[]>;
};

export { type RendererConfig } from './src/modules/config/browser';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
    config: RendererConfig;
    personalizationAPI: PersonalizationAPI;
    authAPI: AuthAPI;
    automergeRepoNetworkAdapter: AutomergeRepoNetworkAdapter;
    filesystemAPI: FilesystemPromiseAPI;
    versionedDocumentStoreAPI: VersionedDocumentStorePromiseAPI;
    singleDocumentProjectStoreAPI: SingleDocumentProjectStorePromiseAPI;
    multiDocumentProjectStoreAPI: MultiDocumentProjectStorePromiseAPI;
    singleDocumentProjectStoreManagerAPI: SingleDocumentProjectStoreManagerAPI;
    multiDocumentProjectStoreManagerAPI: MultiDocumentProjectStoreManagerAPI;
    versionControlSyncProvidersAPI: VersionControlSyncProvidersAPI;
    wasmAPI: WasmAPI;
    osEventsAPI: OsEventsAPI;
  }
}
