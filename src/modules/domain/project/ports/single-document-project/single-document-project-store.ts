import * as Effect from 'effect/Effect';

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
  type VersionedSingleDocumentProject,
} from '../../models';

export type CreateSingleDocumentProjectArgs = {
  documentMetaData: BaseArtifactMetaData;
  name: string | null;
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

export type SingleDocumentProjectMergeAndDeleteBranchArgs = {
  projectId: ProjectId;
  from: Branch;
  into: Branch;
};

export type SingleDocumentProjectStore = {
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
    void,
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
  disconnect: () => Effect.Effect<void, RepositoryError, never>;
};
