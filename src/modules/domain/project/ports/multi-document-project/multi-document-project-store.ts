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
} from '../../../../../modules/infrastructure/version-control';
import { type Email, type Username } from '../../../../auth';
import { NotFoundError, RepositoryError, ValidationError } from '../../errors';
import {
  type ArtifactMetaData,
  type MultiDocumentProject,
  type ProjectId,
  type ProjectRelPath,
  type ReferencedAsset,
  type RemoteProjectInfo,
  type VersionedMultiDocumentProject,
} from '../../models';

type UserInfo = {
  username: Username | null;
  email: Email | null;
};

export type CreateMultiDocumentProjectArgs = {
  path: string;
  documents?: MultiDocumentProject['documents'];
  cloneUrl?: string;
  authToken?: string;
} & UserInfo;

export type AddDocumentToMultiDocumentProjectArgs = {
  documentId: ResolvedArtifactId;
  name: string;
  path: string;
  projectId: ProjectId;
};

export type AddAssetToMultiDocumentProjectArgs = {
  projectId: ProjectId;
  name: string;
  content: Uint8Array;
};

export type DeleteAssetFromMultiDocumentProjectArgs = {
  projectId: ProjectId;
  assetId: ResolvedArtifactId;
};

export type LookupAssetByNameInMultiDocumentProjectArgs = {
  projectId: ProjectId;
  name: string;
};

export type ReadAssetBytesFromMultiDocumentProjectArgs = {
  projectId: ProjectId;
  relPath: ProjectRelPath;
};

export type ReadDocumentReferencedAssetsFromMultiDocumentProjectArgs = {
  projectId: ProjectId;
  documentId: ResolvedArtifactId;
};

export type GetProjectRelativePathArgs = {
  projectId: ProjectId;
  absolutePath: string;
};

export type DeleteDocumentFromMultiDocumentProjectArgs = {
  projectId: ProjectId;
  documentId: ResolvedArtifactId;
};

export type DeleteDocumentsFromMultiDocumentProjectArgs = {
  projectId: ProjectId;
  documentIds: ResolvedArtifactId[];
};

export type RenameDocumentInMultiDocumentProjectArgs = {
  projectId: ProjectId;
  oldDocumentPath: string;
  newDocumentPath: string;
};

export type RenameDocumentsInMultiDocumentProjectArgs = {
  projectId: ProjectId;
  documentRenames: Array<{ oldDocumentPath: string; newDocumentPath: string }>;
};

export type FindDocumentInMultiDocumentProjectArgs = {
  projectId: ProjectId;
  documentPath: string;
  changeId?: ChangeId;
};

export type MultiDocumentProjectCommitChangesArgs = {
  projectId: ProjectId;
  message: string;
};

export type MultiDocumentProjectCommitDocumentChangesArgs = {
  projectId: ProjectId;
  documentId: ResolvedArtifactId;
  message: string;
};

export type CommitDocumentChangesResult = {
  commitId: Commit['id'];
  // Referenced assets that were not on disk and so were left out of the commit.
  skippedAssetPaths: ProjectRelPath[];
};

export type MultiDocumentProjectRestoreDocumentChangesArgs = {
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

export type MultiDocumentProjectCreateAndSwitchToBranchArgs = {
  projectId: ProjectId;
  branch: Branch;
};

export type MultiDocumentProjectSwitchToBranchArgs = {
  projectId: ProjectId;
  branch: Branch;
};

export type MultiDocumentProjectGetCurrentBranchArgs = {
  projectId: ProjectId;
};

export type MultiDocumentProjectListBranchesArgs = {
  projectId: ProjectId;
};

export type MultiDocumentProjectDeleteBranchArgs = {
  projectId: ProjectId;
  branch: Branch;
};

export type MultiDocumentProjectDeleteBranchResult = {
  currentBranch: Branch;
};

export type MultiDocumentProjectMergeAndDeleteBranchArgs = {
  projectId: ProjectId;
  from: Branch;
  into: Branch;
};

export type MultiDocumentProjectIsInMergeConflictStateArgs = {
  projectId: ProjectId;
};

export type MultiDocumentProjectGetMergeConflictInfoArgs = {
  projectId: ProjectId;
};

export type MultiDocumentProjectAbortMergeArgs = {
  projectId: ProjectId;
};

export type MultiDocumentProjectResolveConflictByKeepingDocumentArgs = {
  projectId: ProjectId;
  documentId: ResolvedArtifactId;
};

export type MultiDocumentProjectResolveConflictByDeletingDocumentArgs = {
  projectId: ProjectId;
  documentId: ResolvedArtifactId;
};

export type MultiDocumentProjectCommitMergeConflictsResolutionArgs = {
  projectId: ProjectId;
  message?: string;
};

export type MultiDocumentProjectSetAuthorInfoArgs = {
  projectId: ProjectId;
  username: Username | null;
  email: Email | null;
};

export type MultiDocumentProjectAddRemoteProjectArgs = {
  projectId: ProjectId;
  remoteName?: string;
  remoteUrl: string;
  authToken?: string;
};

export type MultiDocumentProjectListRemoteProjectsArgs = {
  projectId: ProjectId;
};

export type MultiDocumentProjectFindRemoteProjectByNameArgs = {
  projectId: ProjectId;
  remoteName: string;
};

export type MultiDocumentProjectPushToRemoteProjectArgs = {
  projectId: ProjectId;
  remoteName?: string;
  authToken?: string;
};

export type MultiDocumentProjectPullFromRemoteProjectArgs = {
  projectId: ProjectId;
  remoteName?: string;
  authToken?: string;
};

export type MultiDocumentProjectGetProjectCommitHistoryArgs = {
  projectId: ProjectId;
  branch: Branch;
  limit?: number;
};

export type MultiDocumentProjectGetChangedDocumentsAtChangeArgs = {
  projectId: ProjectId;
  changeId: ChangeId;
};

export type MultiDocumentProjectGetRemoteBranchInfoArgs = {
  projectId: ProjectId;
  remoteName?: string;
  authToken?: string;
};

export type MultiDocumentProjectGetRemoteBranchInfoResult = Record<
  Branch,
  Commit['id']
>;

export type MultiDocumentProjectStore = {
  supportsBranching: boolean;
  assetsDirName: string;
  createProject: (
    args: CreateMultiDocumentProjectArgs
  ) => Effect.Effect<ProjectId, ValidationError | RepositoryError, never>;
  findProjectById: (
    id: ProjectId
  ) => Effect.Effect<
    VersionedMultiDocumentProject,
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
    args: AddDocumentToMultiDocumentProjectArgs
  ) => Effect.Effect<
    void,
    ValidationError | MigrationError | RepositoryError | NotFoundError,
    never
  >;
  deleteDocumentFromProject: (
    args: DeleteDocumentFromMultiDocumentProjectArgs
  ) => Effect.Effect<
    void,
    ValidationError | MigrationError | RepositoryError | NotFoundError,
    never
  >;
  deleteDocumentsFromProject: (
    args: DeleteDocumentsFromMultiDocumentProjectArgs
  ) => Effect.Effect<
    void,
    ValidationError | MigrationError | RepositoryError | NotFoundError,
    never
  >;
  renameDocumentInProject: (
    args: RenameDocumentInMultiDocumentProjectArgs
  ) => Effect.Effect<
    void,
    ValidationError | MigrationError | RepositoryError | NotFoundError,
    never
  >;
  renameDocumentsInProject: (
    args: RenameDocumentsInMultiDocumentProjectArgs
  ) => Effect.Effect<
    void,
    ValidationError | MigrationError | RepositoryError | NotFoundError,
    never
  >;
  findDocumentInProject: (
    args: FindDocumentInMultiDocumentProjectArgs
  ) => Effect.Effect<
    ResolvedArtifactId,
    ValidationError | RepositoryError | NotFoundError | MigrationError,
    never
  >;
  addAssetToProject: (
    args: AddAssetToMultiDocumentProjectArgs
  ) => Effect.Effect<
    ResolvedArtifactId,
    ValidationError | MigrationError | RepositoryError | NotFoundError,
    never
  >;
  deleteAssetFromProject: (
    args: DeleteAssetFromMultiDocumentProjectArgs
  ) => Effect.Effect<
    void,
    ValidationError | MigrationError | RepositoryError | NotFoundError,
    never
  >;
  lookupAssetByName: (
    args: LookupAssetByNameInMultiDocumentProjectArgs
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
    args: ReadAssetBytesFromMultiDocumentProjectArgs
  ) => Effect.Effect<
    Uint8Array,
    ValidationError | RepositoryError | NotFoundError,
    never
  >;
  readDocumentReferencedAssets: (
    args: ReadDocumentReferencedAssetsFromMultiDocumentProjectArgs
  ) => Effect.Effect<
    ReferencedAsset[],
    ValidationError | RepositoryError | NotFoundError,
    never
  >;
  getProjectRelativePath: (
    args: GetProjectRelativePathArgs
  ) => Effect.Effect<string | null, RepositoryError, never>;
  commitChanges: (
    args: MultiDocumentProjectCommitChangesArgs
  ) => Effect.Effect<Commit['id'], ValidationError | RepositoryError, never>;
  commitDocumentChanges: (
    args: MultiDocumentProjectCommitDocumentChangesArgs
  ) => Effect.Effect<
    CommitDocumentChangesResult,
    ValidationError | RepositoryError | NotFoundError,
    never
  >;
  restoreDocumentChanges: (
    args: MultiDocumentProjectRestoreDocumentChangesArgs
  ) => Effect.Effect<
    RestoreDocumentChangesResult,
    ValidationError | RepositoryError | NotFoundError | MigrationError,
    never
  >;
  createAndSwitchToBranch: (
    args: MultiDocumentProjectCreateAndSwitchToBranchArgs
  ) => Effect.Effect<void, ValidationError | RepositoryError, never>;
  switchToBranch: (
    args: MultiDocumentProjectSwitchToBranchArgs
  ) => Effect.Effect<void, ValidationError | RepositoryError, never>;
  getCurrentBranch: (
    args: MultiDocumentProjectGetCurrentBranchArgs
  ) => Effect.Effect<
    Branch,
    ValidationError | RepositoryError | NotFoundError,
    never
  >;
  listBranches: (
    args: MultiDocumentProjectListBranchesArgs
  ) => Effect.Effect<
    Branch[],
    ValidationError | RepositoryError | NotFoundError,
    never
  >;
  deleteBranch: (
    args: MultiDocumentProjectDeleteBranchArgs
  ) => Effect.Effect<
    MultiDocumentProjectDeleteBranchResult,
    ValidationError | RepositoryError | NotFoundError,
    never
  >;
  mergeAndDeleteBranch: (
    args: MultiDocumentProjectMergeAndDeleteBranchArgs
  ) => Effect.Effect<
    Commit['id'],
    ValidationError | RepositoryError | NotFoundError | MergeConflictError,
    never
  >;
  getMergeConflictInfo: (
    args: MultiDocumentProjectGetMergeConflictInfoArgs
  ) => Effect.Effect<
    MergeConflictInfo | null,
    ValidationError | RepositoryError,
    never
  >;
  abortMerge: (
    args: MultiDocumentProjectAbortMergeArgs
  ) => Effect.Effect<void, ValidationError | RepositoryError, never>;
  resolveConflictByKeepingDocument: (
    args: MultiDocumentProjectResolveConflictByKeepingDocumentArgs
  ) => Effect.Effect<void, ValidationError | RepositoryError, never>;
  resolveConflictByDeletingDocument: (
    args: MultiDocumentProjectResolveConflictByDeletingDocumentArgs
  ) => Effect.Effect<void, ValidationError | RepositoryError, never>;
  commitMergeConflictsResolution: (
    args: MultiDocumentProjectCommitMergeConflictsResolutionArgs
  ) => Effect.Effect<Commit['id'], ValidationError | RepositoryError, never>;
  setAuthorInfo: (
    args: MultiDocumentProjectSetAuthorInfoArgs
  ) => Effect.Effect<void, ValidationError | RepositoryError, never>;
  // TODO: Consider moving to a separate, composable type like ExplicitSyncProjectStore
  addRemoteProject: (
    args: MultiDocumentProjectAddRemoteProjectArgs
  ) => Effect.Effect<void, ValidationError | RepositoryError, never>;
  listRemoteProjects: (
    args: MultiDocumentProjectListRemoteProjectsArgs
  ) => Effect.Effect<
    RemoteProjectInfo[],
    ValidationError | RepositoryError,
    never
  >;
  findRemoteProjectByName: (
    args: MultiDocumentProjectFindRemoteProjectByNameArgs
  ) => Effect.Effect<
    RemoteProjectInfo,
    ValidationError | RepositoryError | NotFoundError,
    never
  >;
  pushToRemoteProject: (
    args: MultiDocumentProjectPushToRemoteProjectArgs
  ) => Effect.Effect<void, ValidationError | RepositoryError, never>;
  pullFromRemoteProject: (
    args: MultiDocumentProjectPullFromRemoteProjectArgs
  ) => Effect.Effect<void, ValidationError | RepositoryError, never>;
  getProjectCommitHistory: (
    args: MultiDocumentProjectGetProjectCommitHistoryArgs
  ) => Effect.Effect<
    Commit[],
    ValidationError | RepositoryError | NotFoundError,
    never
  >;
  getChangedDocumentsAtChange: (
    args: MultiDocumentProjectGetChangedDocumentsAtChangeArgs
  ) => Effect.Effect<
    ChangedDocument[],
    ValidationError | RepositoryError,
    never
  >;
  getRemoteBranchInfo: (
    args: MultiDocumentProjectGetRemoteBranchInfoArgs
  ) => Effect.Effect<
    MultiDocumentProjectGetRemoteBranchInfoResult,
    ValidationError | RepositoryError | NotFoundError,
    never
  >;
};
