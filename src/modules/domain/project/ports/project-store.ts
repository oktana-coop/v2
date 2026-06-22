import * as Effect from 'effect/Effect';

import {
  type Branch,
  type ChangedDocument,
  type ChangeId,
  type Commit,
  MergeConflictError,
  type MergeConflictInfo,
  MigrationError,
  type ResolvedArtifactId,
} from '../../../../modules/infrastructure/version-control';
import { type Email, type Username } from '../../../auth';
import { NotFoundError, RepositoryError, ValidationError } from '../errors';
import {
  type ArtifactMetaData,
  type Project,
  type ProjectId,
  type ProjectRelPath,
  type ReferencedAsset,
  type RemoteProjectInfo,
  type VersionedProject,
} from '../models';

type UserInfo = {
  username: Username | null;
  email: Email | null;
};

export type CreateProjectArgs = {
  path: string;
  documents?: Project['documents'];
  cloneUrl?: string;
  authToken?: string;
} & UserInfo;

export type AddDocumentToProjectArgs = {
  documentId: ResolvedArtifactId;
  name: string;
  path: string;
  projectId: ProjectId;
};

export type AddAssetToProjectArgs = {
  projectId: ProjectId;
  name: string;
  content: Uint8Array;
};

export type DeleteAssetFromProjectArgs = {
  projectId: ProjectId;
  assetId: ResolvedArtifactId;
};

export type LookupAssetByNameInProjectArgs = {
  projectId: ProjectId;
  name: string;
};

export type ReadAssetBytesFromProjectArgs = {
  projectId: ProjectId;
  relPath: ProjectRelPath;
};

export type ReadDocumentReferencedAssetsFromProjectArgs = {
  projectId: ProjectId;
  documentId: ResolvedArtifactId;
};

export type GetProjectRelativePathArgs = {
  projectId: ProjectId;
  absolutePath: string;
};

export type DeleteDocumentFromProjectArgs = {
  projectId: ProjectId;
  documentId: ResolvedArtifactId;
};

export type DeleteDocumentsFromProjectArgs = {
  projectId: ProjectId;
  documentIds: ResolvedArtifactId[];
};

export type RenameDocumentInProjectArgs = {
  projectId: ProjectId;
  oldDocumentPath: string;
  newDocumentPath: string;
};

export type RenameDocumentsInProjectArgs = {
  projectId: ProjectId;
  documentRenames: Array<{ oldDocumentPath: string; newDocumentPath: string }>;
};

export type FindDocumentInProjectArgs = {
  projectId: ProjectId;
  documentPath: string;
  changeId?: ChangeId;
};

export type ProjectCommitChangesArgs = {
  projectId: ProjectId;
  message: string;
};

export type ProjectCommitDocumentChangesArgs = {
  projectId: ProjectId;
  documentId: ResolvedArtifactId;
  message: string;
};

export type CommitDocumentChangesResult = {
  commitId: Commit['id'];
  // Referenced assets that were not on disk and so were left out of the commit.
  skippedAssetPaths: ProjectRelPath[];
};

export type ProjectRestoreDocumentChangesArgs = {
  projectId: ProjectId;
  documentId: ResolvedArtifactId;
  commit: Commit;
  message?: string;
};

export type RestoreDocumentChangesResult = {
  commitId: Commit['id'];
  // Referenced assets that could not be read from the restored commit and so
  // were left out (the restored document keeps a dangling reference to them).
  skippedAssetPaths: ProjectRelPath[];
};

export type ProjectCreateAndSwitchToBranchArgs = {
  projectId: ProjectId;
  branch: Branch;
};

export type ProjectSwitchToBranchArgs = {
  projectId: ProjectId;
  branch: Branch;
};

export type ProjectGetCurrentBranchArgs = {
  projectId: ProjectId;
};

export type ProjectListBranchesArgs = {
  projectId: ProjectId;
};

export type ProjectDeleteBranchArgs = {
  projectId: ProjectId;
  branch: Branch;
};

export type ProjectDeleteBranchResult = {
  currentBranch: Branch;
};

export type ProjectMergeAndDeleteBranchArgs = {
  projectId: ProjectId;
  from: Branch;
  into: Branch;
};

export type ProjectIsInMergeConflictStateArgs = {
  projectId: ProjectId;
};

export type ProjectGetMergeConflictInfoArgs = {
  projectId: ProjectId;
};

export type ProjectAbortMergeArgs = {
  projectId: ProjectId;
};

export type ProjectResolveConflictByKeepingDocumentArgs = {
  projectId: ProjectId;
  documentId: ResolvedArtifactId;
};

export type ProjectResolveConflictByDeletingDocumentArgs = {
  projectId: ProjectId;
  documentId: ResolvedArtifactId;
};

export type ProjectCommitMergeConflictsResolutionArgs = {
  projectId: ProjectId;
  message?: string;
};

export type ProjectSetAuthorInfoArgs = {
  projectId: ProjectId;
  username: Username | null;
  email: Email | null;
};

export type ProjectAddRemoteProjectArgs = {
  projectId: ProjectId;
  remoteName?: string;
  remoteUrl: string;
  authToken?: string;
};

export type ProjectListRemoteProjectsArgs = {
  projectId: ProjectId;
};

export type ProjectFindRemoteProjectByNameArgs = {
  projectId: ProjectId;
  remoteName: string;
};

export type ProjectPushToRemoteProjectArgs = {
  projectId: ProjectId;
  remoteName?: string;
  authToken?: string;
};

export type ProjectPullFromRemoteProjectArgs = {
  projectId: ProjectId;
  remoteName?: string;
  authToken?: string;
};

export type ProjectGetProjectCommitHistoryArgs = {
  projectId: ProjectId;
  branch: Branch;
  limit?: number;
};

export type ProjectGetChangedDocumentsAtChangeArgs = {
  projectId: ProjectId;
  changeId: ChangeId;
};

export type ProjectGetRemoteBranchInfoArgs = {
  projectId: ProjectId;
  remoteName?: string;
  authToken?: string;
};

export type ProjectGetRemoteBranchInfoResult = Record<Branch, Commit['id']>;

export type ProjectStore = {
  supportsBranching: boolean;
  assetsDirName: string;
  createProject: (
    args: CreateProjectArgs
  ) => Effect.Effect<ProjectId, ValidationError | RepositoryError, never>;
  findProjectById: (
    id: ProjectId
  ) => Effect.Effect<
    VersionedProject,
    ValidationError | RepositoryError | NotFoundError | MigrationError,
    never
  >;
  listProjectDocuments: (
    id: ProjectId
  ) => Effect.Effect<
    ArtifactMetaData[],
    ValidationError | RepositoryError | NotFoundError | MigrationError,
    never
  >;
  addDocumentToProject: (
    args: AddDocumentToProjectArgs
  ) => Effect.Effect<
    void,
    ValidationError | MigrationError | RepositoryError | NotFoundError,
    never
  >;
  deleteDocumentFromProject: (
    args: DeleteDocumentFromProjectArgs
  ) => Effect.Effect<
    void,
    ValidationError | MigrationError | RepositoryError | NotFoundError,
    never
  >;
  deleteDocumentsFromProject: (
    args: DeleteDocumentsFromProjectArgs
  ) => Effect.Effect<
    void,
    ValidationError | MigrationError | RepositoryError | NotFoundError,
    never
  >;
  renameDocumentInProject: (
    args: RenameDocumentInProjectArgs
  ) => Effect.Effect<
    void,
    ValidationError | MigrationError | RepositoryError | NotFoundError,
    never
  >;
  renameDocumentsInProject: (
    args: RenameDocumentsInProjectArgs
  ) => Effect.Effect<
    void,
    ValidationError | MigrationError | RepositoryError | NotFoundError,
    never
  >;
  findDocumentInProject: (
    args: FindDocumentInProjectArgs
  ) => Effect.Effect<
    ResolvedArtifactId,
    ValidationError | RepositoryError | NotFoundError | MigrationError,
    never
  >;
  addAssetToProject: (
    args: AddAssetToProjectArgs
  ) => Effect.Effect<
    ResolvedArtifactId,
    ValidationError | MigrationError | RepositoryError | NotFoundError,
    never
  >;
  deleteAssetFromProject: (
    args: DeleteAssetFromProjectArgs
  ) => Effect.Effect<
    void,
    ValidationError | MigrationError | RepositoryError | NotFoundError,
    never
  >;
  lookupAssetByName: (
    args: LookupAssetByNameInProjectArgs
  ) => Effect.Effect<
    ResolvedArtifactId,
    ValidationError | RepositoryError | NotFoundError | MigrationError,
    never
  >;
  listProjectAssets: (
    id: ProjectId
  ) => Effect.Effect<
    ArtifactMetaData[],
    ValidationError | RepositoryError | NotFoundError | MigrationError,
    never
  >;
  readAssetBytes: (
    args: ReadAssetBytesFromProjectArgs
  ) => Effect.Effect<
    Uint8Array,
    ValidationError | RepositoryError | NotFoundError,
    never
  >;
  readDocumentReferencedAssets: (
    args: ReadDocumentReferencedAssetsFromProjectArgs
  ) => Effect.Effect<
    ReferencedAsset[],
    ValidationError | RepositoryError | NotFoundError,
    never
  >;
  getProjectRelativePath: (
    args: GetProjectRelativePathArgs
  ) => Effect.Effect<string | null, RepositoryError, never>;
  commitChanges: (
    args: ProjectCommitChangesArgs
  ) => Effect.Effect<Commit['id'], ValidationError | RepositoryError, never>;
  commitDocumentChanges: (
    args: ProjectCommitDocumentChangesArgs
  ) => Effect.Effect<
    CommitDocumentChangesResult,
    ValidationError | RepositoryError | NotFoundError,
    never
  >;
  restoreDocumentChanges: (
    args: ProjectRestoreDocumentChangesArgs
  ) => Effect.Effect<
    RestoreDocumentChangesResult,
    ValidationError | RepositoryError | NotFoundError | MigrationError,
    never
  >;
  createAndSwitchToBranch: (
    args: ProjectCreateAndSwitchToBranchArgs
  ) => Effect.Effect<void, ValidationError | RepositoryError, never>;
  switchToBranch: (
    args: ProjectSwitchToBranchArgs
  ) => Effect.Effect<void, ValidationError | RepositoryError, never>;
  getCurrentBranch: (
    args: ProjectGetCurrentBranchArgs
  ) => Effect.Effect<
    Branch,
    ValidationError | RepositoryError | NotFoundError,
    never
  >;
  listBranches: (
    args: ProjectListBranchesArgs
  ) => Effect.Effect<
    Branch[],
    ValidationError | RepositoryError | NotFoundError,
    never
  >;
  deleteBranch: (
    args: ProjectDeleteBranchArgs
  ) => Effect.Effect<
    ProjectDeleteBranchResult,
    ValidationError | RepositoryError | NotFoundError,
    never
  >;
  mergeAndDeleteBranch: (
    args: ProjectMergeAndDeleteBranchArgs
  ) => Effect.Effect<
    Commit['id'],
    ValidationError | RepositoryError | NotFoundError | MergeConflictError,
    never
  >;
  getMergeConflictInfo: (
    args: ProjectGetMergeConflictInfoArgs
  ) => Effect.Effect<
    MergeConflictInfo | null,
    ValidationError | RepositoryError,
    never
  >;
  abortMerge: (
    args: ProjectAbortMergeArgs
  ) => Effect.Effect<void, ValidationError | RepositoryError, never>;
  resolveConflictByKeepingDocument: (
    args: ProjectResolveConflictByKeepingDocumentArgs
  ) => Effect.Effect<void, ValidationError | RepositoryError, never>;
  resolveConflictByDeletingDocument: (
    args: ProjectResolveConflictByDeletingDocumentArgs
  ) => Effect.Effect<void, ValidationError | RepositoryError, never>;
  commitMergeConflictsResolution: (
    args: ProjectCommitMergeConflictsResolutionArgs
  ) => Effect.Effect<Commit['id'], ValidationError | RepositoryError, never>;
  setAuthorInfo: (
    args: ProjectSetAuthorInfoArgs
  ) => Effect.Effect<void, ValidationError | RepositoryError, never>;
  // TODO: Consider moving to a separate, composable type like ExplicitSyncProjectStore
  addRemoteProject: (
    args: ProjectAddRemoteProjectArgs
  ) => Effect.Effect<void, ValidationError | RepositoryError, never>;
  listRemoteProjects: (
    args: ProjectListRemoteProjectsArgs
  ) => Effect.Effect<
    RemoteProjectInfo[],
    ValidationError | RepositoryError,
    never
  >;
  findRemoteProjectByName: (
    args: ProjectFindRemoteProjectByNameArgs
  ) => Effect.Effect<
    RemoteProjectInfo,
    ValidationError | RepositoryError | NotFoundError,
    never
  >;
  pushToRemoteProject: (
    args: ProjectPushToRemoteProjectArgs
  ) => Effect.Effect<void, ValidationError | RepositoryError, never>;
  pullFromRemoteProject: (
    args: ProjectPullFromRemoteProjectArgs
  ) => Effect.Effect<void, ValidationError | RepositoryError, never>;
  getProjectCommitHistory: (
    args: ProjectGetProjectCommitHistoryArgs
  ) => Effect.Effect<
    Commit[],
    ValidationError | RepositoryError | NotFoundError,
    never
  >;
  getChangedDocumentsAtChange: (
    args: ProjectGetChangedDocumentsAtChangeArgs
  ) => Effect.Effect<
    ChangedDocument[],
    ValidationError | RepositoryError,
    never
  >;
  getRemoteBranchInfo: (
    args: ProjectGetRemoteBranchInfoArgs
  ) => Effect.Effect<
    ProjectGetRemoteBranchInfoResult,
    ValidationError | RepositoryError | NotFoundError,
    never
  >;
};
