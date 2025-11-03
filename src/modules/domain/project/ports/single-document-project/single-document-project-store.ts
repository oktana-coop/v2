import * as Effect from 'effect/Effect';

import {
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
  disconnect: () => Effect.Effect<void, RepositoryError, never>;
};
