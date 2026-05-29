import * as Effect from 'effect/Effect';

import { type Email, type Username } from '../../../../auth';
import {
  type Branch,
  type Commit,
  MergeConflictError,
  type MergeConflictInfo,
  MigrationError,
  type ResolvedArtifactId,
} from '../../../../infrastructure/version-control';
import { NotFoundError, RepositoryError, ValidationError } from '../../errors';
import {
  type ArtifactMetaData,
  type BaseArtifactMetaData,
  type ProjectId,
  type ProjectRelPath,
  type RemoteProjectInfo,
  type VersionedSingleDocumentProject,
} from '../../models';

type UserInfo = {
  username: Username | null;
  email: Email | null;
};

export type CreateSingleDocumentProjectArgs = {
  documentMetaData: BaseArtifactMetaData;
  name: string | null;
  cloneUrl?: string;
  authToken?: string;
} & UserInfo;

export type AddAssetToSingleDocumentProjectArgs = {
  projectId: ProjectId;
  name: string;
  content: Uint8Array;
};

export type DeleteAssetFromSingleDocumentProjectArgs = {
  projectId: ProjectId;
  assetId: ResolvedArtifactId;
};

export type LookupAssetByNameInSingleDocumentProjectArgs = {
  projectId: ProjectId;
  name: string;
};

export type ReadAssetBytesFromSingleDocumentProjectArgs = {
  projectId: ProjectId;
  relPath: ProjectRelPath;
};

export type SingleDocumentProjectCommitChangesArgs = {
  projectId: ProjectId;
  message: string;
};

export type SingleDocumentProjectRestoreChangesArgs = {
  projectId: ProjectId;
  commit: Commit;
  message?: string;
};

export type SingleDocumentProjectCreateAndSwitchToBranchArgs = {
  projectId: ProjectId;
  branch: Branch;
};

export type SingleDocumentProjectSwitchToBranchArgs = {
  projectId: ProjectId;
  branch: Branch;
};

export type SingleDocumentProjectGetCurrentBranchArgs = {
  projectId: ProjectId;
};

export type SingleDocumentProjectListBranchesArgs = {
  projectId: ProjectId;
};

export type SingleDocumentProjectDeleteBranchArgs = {
  projectId: ProjectId;
  branch: Branch;
};

export type SingleDocumentProjectDeleteBranchResult = {
  currentBranch: Branch;
};

export type SingleDocumentProjectMergeAndDeleteBranchArgs = {
  projectId: ProjectId;
  from: Branch;
  into: Branch;
};

export type SingleDocumentProjectIsInMergeConflictStateArgs = {
  projectId: ProjectId;
};

export type SingleDocumentProjectGetMergeConflictInfoArgs = {
  projectId: ProjectId;
};

export type SingleDocumentProjectAbortMergeArgs = {
  projectId: ProjectId;
};

export type SingleDocumentProjectCommitMergeConflictsResolutionArgs = {
  projectId: ProjectId;
  message?: string;
};

export type SingleDocumentProjectSetAuthorInfoArgs = {
  projectId: ProjectId;
} & UserInfo;

export type SingleDocumentProjectAddRemoteProjectArgs = {
  projectId: ProjectId;
  remoteName?: string;
  remoteUrl: string;
  authToken?: string;
};

export type SingleDocumentProjectListRemoteProjectsArgs = {
  projectId: ProjectId;
};

export type SingleDocumentProjectFindRemoteProjectByNameArgs = {
  projectId: ProjectId;
  remoteName: string;
};

export type SingleDocumentProjectPushToRemoteProjectArgs = {
  projectId: ProjectId;
  remoteName?: string;
  authToken?: string;
};

export type SingleDocumentProjectPullFromRemoteProjectArgs = {
  projectId: ProjectId;
  remoteName?: string;
  authToken?: string;
};

export type SingleDocumentProjectGetRemoteBranchInfoArgs = {
  projectId: ProjectId;
  remoteName?: string;
  authToken?: string;
};

export type SingleDocumentProjectGetRemoteBranchInfoResult = Record<
  Branch,
  Commit['id']
>;

export type SingleDocumentProjectStore = {
  supportsBranching: boolean;
  assetsDirName: string;
  createSingleDocumentProject: (
    args: CreateSingleDocumentProjectArgs
  ) => Effect.Effect<ProjectId, ValidationError | RepositoryError, never>;
  findDocumentInProject: (
    projectId: ProjectId
  ) => Effect.Effect<
    ResolvedArtifactId,
    ValidationError | RepositoryError | NotFoundError | MigrationError,
    never
  >;
  findProjectById: (
    projectId: ProjectId
  ) => Effect.Effect<
    VersionedSingleDocumentProject,
    ValidationError | RepositoryError | NotFoundError | MigrationError,
    never
  >;
  getProjectName: (
    projectId: ProjectId
  ) => Effect.Effect<
    string | null,
    ValidationError | RepositoryError | NotFoundError | MigrationError,
    never
  >;
  addAssetToProject: (
    args: AddAssetToSingleDocumentProjectArgs
  ) => Effect.Effect<
    ResolvedArtifactId,
    ValidationError | MigrationError | RepositoryError | NotFoundError,
    never
  >;
  deleteAssetFromProject: (
    args: DeleteAssetFromSingleDocumentProjectArgs
  ) => Effect.Effect<
    void,
    ValidationError | MigrationError | RepositoryError | NotFoundError,
    never
  >;
  lookupAssetByName: (
    args: LookupAssetByNameInSingleDocumentProjectArgs
  ) => Effect.Effect<
    ResolvedArtifactId,
    ValidationError | RepositoryError | NotFoundError | MigrationError,
    never
  >;
  listProjectAssets: (
    projectId: ProjectId
  ) => Effect.Effect<
    ArtifactMetaData[],
    ValidationError | RepositoryError | NotFoundError | MigrationError,
    never
  >;
  readAssetBytes: (
    args: ReadAssetBytesFromSingleDocumentProjectArgs
  ) => Effect.Effect<
    Uint8Array,
    ValidationError | RepositoryError | NotFoundError,
    never
  >;
  commitChanges: (
    args: SingleDocumentProjectCommitChangesArgs
  ) => Effect.Effect<Commit['id'], ValidationError | RepositoryError, never>;
  // Restores the document and its referenced assets to an earlier commit,
  // then makes a new commit. Reads doc + asset bytes from the historical
  // commit (not the current SQLite-fs working tree), writes them back,
  // stages, and commits. Assets referenced in the historical doc that
  // aren't present at that commit are skipped — see the multi-doc
  // counterpart for the rationale.
  restoreChanges: (
    args: SingleDocumentProjectRestoreChangesArgs
  ) => Effect.Effect<
    Commit['id'],
    ValidationError | RepositoryError | NotFoundError | MigrationError,
    never
  >;
  createAndSwitchToBranch: (
    args: SingleDocumentProjectCreateAndSwitchToBranchArgs
  ) => Effect.Effect<void, ValidationError | RepositoryError, never>;
  switchToBranch: (
    args: SingleDocumentProjectSwitchToBranchArgs
  ) => Effect.Effect<void, ValidationError | RepositoryError, never>;
  getCurrentBranch: (
    args: SingleDocumentProjectGetCurrentBranchArgs
  ) => Effect.Effect<
    Branch,
    ValidationError | RepositoryError | NotFoundError,
    never
  >;
  listBranches: (
    args: SingleDocumentProjectListBranchesArgs
  ) => Effect.Effect<
    Branch[],
    ValidationError | RepositoryError | NotFoundError,
    never
  >;
  deleteBranch: (
    args: SingleDocumentProjectDeleteBranchArgs
  ) => Effect.Effect<
    SingleDocumentProjectDeleteBranchResult,
    ValidationError | RepositoryError | NotFoundError,
    never
  >;
  mergeAndDeleteBranch: (
    args: SingleDocumentProjectMergeAndDeleteBranchArgs
  ) => Effect.Effect<
    Commit['id'],
    ValidationError | RepositoryError | NotFoundError | MergeConflictError,
    never
  >;
  getMergeConflictInfo: (
    args: SingleDocumentProjectGetMergeConflictInfoArgs
  ) => Effect.Effect<MergeConflictInfo | null, RepositoryError, never>;
  abortMerge: (
    args: SingleDocumentProjectAbortMergeArgs
  ) => Effect.Effect<void, RepositoryError, never>;
  commitMergeConflictsResolution: (
    args: SingleDocumentProjectCommitMergeConflictsResolutionArgs
  ) => Effect.Effect<Commit['id'], RepositoryError, never>;
  setAuthorInfo: (
    args: SingleDocumentProjectSetAuthorInfoArgs
  ) => Effect.Effect<void, RepositoryError, never>;
  // TODO: Consider moving to a separate, composable type like ExplicitSyncProjectStore
  addRemoteProject: (
    args: SingleDocumentProjectAddRemoteProjectArgs
  ) => Effect.Effect<void, ValidationError | RepositoryError, never>;
  listRemoteProjects: (
    args: SingleDocumentProjectListRemoteProjectsArgs
  ) => Effect.Effect<
    RemoteProjectInfo[],
    ValidationError | RepositoryError,
    never
  >;
  findRemoteProjectByName: (
    args: SingleDocumentProjectFindRemoteProjectByNameArgs
  ) => Effect.Effect<
    RemoteProjectInfo,
    ValidationError | RepositoryError | NotFoundError,
    never
  >;
  pushToRemoteProject: (
    args: SingleDocumentProjectPushToRemoteProjectArgs
  ) => Effect.Effect<void, ValidationError | RepositoryError, never>;
  pullFromRemoteProject: (
    args: SingleDocumentProjectPullFromRemoteProjectArgs
  ) => Effect.Effect<void, ValidationError | RepositoryError, never>;
  getRemoteBranchInfo: (
    args: SingleDocumentProjectGetRemoteBranchInfoArgs
  ) => Effect.Effect<
    SingleDocumentProjectGetRemoteBranchInfoResult,
    ValidationError | RepositoryError | NotFoundError,
    never
  >;
  disconnect: () => Effect.Effect<void, RepositoryError, never>;
};
