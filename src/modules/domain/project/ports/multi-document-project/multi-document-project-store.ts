import * as Effect from 'effect/Effect';

import {
  MigrationError,
  type ResolvedArtifactId,
} from '../../../../../modules/infrastructure/version-control';
import { NotFoundError, RepositoryError, ValidationError } from '../../errors';
import type {
  ArtifactMetaData,
  MultiDocumentProject,
  ProjectId,
  VersionedMultiDocumentProject,
  VersionedMultiDocumentProjectHandle,
} from '../../models';

export type CreateMultiDocumentProjectArgs = {
  path: string;
  documents: MultiDocumentProject['documents'];
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

export type MultiDocumentProjectStore = {
  createProject: (
    args: CreateMultiDocumentProjectArgs
  ) => Effect.Effect<ProjectId, RepositoryError, never>;
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
  getProjectFromHandle: (
    handle: VersionedMultiDocumentProjectHandle
  ) => Effect.Effect<
    VersionedMultiDocumentProject,
    RepositoryError | NotFoundError,
    never
  >;
};
