import * as Effect from 'effect/Effect';

import { type Email, type Username } from '../../../../auth';
import {
  type Branch,
  type Commit,
  MergeConflictError,
  MigrationError,
  type ResolvedArtifactId,
} from '../../../../infrastructure/version-control';
import { NotFoundError, RepositoryError, ValidationError } from '../../errors';
import {
  type BaseArtifactMetaData,
  type ProjectId,
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
} & UserInfo;

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

export type SingleDocumentProjectStore = {
  supportsBranching: boolean;
  createSingleDocumentProject: (
    args: CreateSingleDocumentProjectArgs
  ) => Effect.Effect<ProjectId, RepositoryError, never>;
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
  disconnect: () => Effect.Effect<void, RepositoryError, never>;
};
