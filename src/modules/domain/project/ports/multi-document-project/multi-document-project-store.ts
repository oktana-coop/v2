import * as Effect from 'effect/Effect';

import {
  type Branch,
  type Commit,
  MergeConflictError,
  MigrationError,
  type ResolvedArtifactId,
} from '../../../../../modules/infrastructure/version-control';
import { NotFoundError, RepositoryError, ValidationError } from '../../errors';
import type {
  ArtifactMetaData,
  MultiDocumentProject,
  ProjectId,
  VersionedMultiDocumentProject,
} from '../../models';

export type CreateMultiDocumentProjectArgs = {
  path: string;
  documents?: MultiDocumentProject['documents'];
};

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

export type MultiDocumentProjectStore = {
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
};
