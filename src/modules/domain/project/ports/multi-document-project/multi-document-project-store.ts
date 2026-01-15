import * as Effect from 'effect/Effect';

import {
  type Branch,
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

export type DeleteDocumentFromMultiDocumentProjectArgs = {
  projectId: ProjectId;
  documentId: ResolvedArtifactId;
};

export type FindDocumentInMultiDocumentProjectArgs = {
  projectId: ProjectId;
  documentPath: string;
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
  findDocumentInProject: (
    args: FindDocumentInMultiDocumentProjectArgs
  ) => Effect.Effect<
    ResolvedArtifactId,
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
  getRemoteBranchInfo: (
    args: MultiDocumentProjectGetRemoteBranchInfoArgs
  ) => Effect.Effect<
    MultiDocumentProjectGetRemoteBranchInfoResult,
    ValidationError | RepositoryError | NotFoundError,
    never
  >;
};
