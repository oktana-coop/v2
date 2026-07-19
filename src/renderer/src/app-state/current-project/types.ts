import {
  type ArtifactMetaData,
  type ProjectId,
  type ProjectStore,
  type ProjectTreeNode,
  type RemoteProjectInfo,
} from '../../../../modules/domain/project';
import { type ResolvedDocument } from '../../../../modules/domain/rich-text';
import { type Directory } from '../../../../modules/infrastructure/filesystem';
import {
  type ArtifactId,
  type Branch,
  type ChangedDocument,
  type ChangeId,
  type Commit,
  type MergeConflictInfo,
} from '../../../../modules/infrastructure/version-control';

export type CreateNewDocumentArgs = {
  name?: string;
  parentPath?: string;
};

export type PendingNewDirectory = {
  parentPath?: string;
};

export type ProjectStateSetters = {
  setCurrentBranch: (branch: Branch) => void;
  setMergeConflictInfo: (mergeConflictInfo: MergeConflictInfo | null) => void;
  setRemoteProject: (remoteProject: RemoteProjectInfo | null) => void;
  setPulledUpstreamChanges: (pulledUpstreamChanges: boolean) => void;
};

export type ProjectContextType = {
  loading: boolean;
  projectId: ProjectId | null;
  directory: Directory | null;
  currentBranch: Branch | null;
  projectStore: ProjectStore | null;
  currentArtifact: ArtifactMetaData | null;
  resolvingCurrentArtifact: boolean;
  directoryTree: ProjectTreeNode[];
  refreshDirectoryTree: () => Promise<void>;
  openDirectory: (cloneUrl?: string) => Promise<Directory>;
  requestPermissionForSelectedDirectory: () => Promise<void>;
  createNewDocument: (args?: CreateNewDocumentArgs) => Promise<{
    projectId: ProjectId;
    documentId: ArtifactId;
    path: string;
  } | null>;
  findDocumentInProject: (args: {
    projectId: ProjectId;
    documentPath: string;
    changeId?: ChangeId;
  }) => Promise<ResolvedDocument>;
  listBranches: () => Promise<Branch[]>;
  createAndSwitchToBranch: (branchName: string) => Promise<void>;
  switchToBranch: (branch: Branch) => Promise<void>;
  isCreateBranchDialogOpen: boolean;
  openCreateBranchDialog: () => void;
  closeCreateBranchDialog: () => void;
  deleteBranch: (branch: Branch) => Promise<void>;
  mergeAndDeleteBranch: (branch: Branch) => Promise<void>;
  abortMerge: () => Promise<void>;
  refreshConflictsAndMergeIfPossible: () => Promise<void>;
  resolveConflictByKeepingDocument: (documentId: ArtifactId) => Promise<void>;
  resolveConflictByDeletingDocument: (documentId: ArtifactId) => Promise<void>;
  branchToDelete: Branch | null;
  openDeleteBranchDialog: (branch: Branch) => void;
  closeDeleteBranchDialog: () => void;
  supportsBranching: boolean;
  supportsSync: boolean;
  mergeConflictInfo: MergeConflictInfo | null;
  remoteProject: RemoteProjectInfo | null;
  addRemoteProject: (url: string) => Promise<void>;
  remoteBranchInfo: Record<Branch, Commit['id']>;
  pushToRemoteProject: () => Promise<void>;
  pullFromRemoteProject: () => Promise<void>;
  pulledUpstreamChanges: boolean;
  onHandlePulledUpstreamChanges: () => void;
  pendingNewDirectory: PendingNewDirectory | null;
  startCreateDirectory: (parentPath?: string) => void;
  createDirectory: (name: string) => Promise<void>;
  cancelCreateDirectory: () => void;
  filePathToDelete: string | null;
  startDeleteDocument: (path: string) => void;
  deleteDocument: (args: { relativePath: string }) => Promise<void>;
  confirmDeleteDocument: () => void;
  cancelDeleteDocument: () => void;
  directoryPathToDelete: string | null;
  startDeleteDirectory: (path: string) => void;
  deleteDirectory: (args: { relativePath: string }) => Promise<void>;
  confirmDeleteDirectory: () => void;
  cancelDeleteDirectory: () => void;
  filePathToRename: string | null;
  startRenameDocument: (path: string) => void;
  renameDocumentError: string | null;
  clearRenameDocumentError: () => void;
  renameDocument: (args: {
    oldRelativePath: string;
    newName: string;
  }) => Promise<void>;
  cancelRenameDocument: () => void;
  directoryPathToRename: string | null;
  startRenameDirectory: (path: string) => void;
  renameDirectoryError: string | null;
  clearRenameDirectoryError: () => void;
  renameDirectory: (args: {
    oldRelativePath: string;
    newName: string;
  }) => Promise<void>;
  cancelRenameDirectory: () => void;
  getProjectHistory: () => Promise<Commit[]>;
  getProjectChangedDocuments: (
    changeId: Commit['id']
  ) => Promise<ChangedDocument[]>;
  getProjectUncommittedChanges: () => Promise<ChangedDocument[]>;
  commitChanges: (message: string) => Promise<void>;
  commitDocumentChanges: (args: {
    documentId: ArtifactId;
    message: string;
  }) => Promise<void>;
  restoreDocumentChanges: (args: {
    documentId: ArtifactId;
    commit: Commit;
    message?: string;
  }) => Promise<Commit['id']>;
};
