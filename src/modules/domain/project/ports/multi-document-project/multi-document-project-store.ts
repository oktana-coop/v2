import * as Effect from 'effect/Effect';

import {
  MigrationError,
  type VersionControlId,
} from '../../../../../modules/infrastructure/version-control';
import { NotFoundError, RepositoryError } from '../../errors';
import type {
  ArtifactMetaData,
  MultiDocumentProject,
  VersionedMultiDocumentProject,
  VersionedMultiDocumentProjectHandle,
} from '../../models';

export type CreateMultiDocumentProjectArgs = {
  path: string;
  documents: MultiDocumentProject['documents'];
};

export type AddDocumentToMultiDocumentProjectArgs = {
  documentId: VersionControlId;
  name: string;
  path: string;
  projectId: VersionControlId;
};

export type DeleteDocumentFromMultiDocumentProjectArgs = {
  projectId: VersionControlId;
  documentId: VersionControlId;
};

export type FindDocumentInMultiDocumentProjectArgs = {
  projectId: VersionControlId;
  documentPath: string;
};

export type MultiDocumentProjectStore = {
  createProject: (
    args: CreateMultiDocumentProjectArgs
  ) => Effect.Effect<VersionControlId, RepositoryError, never>;
  findProjectById: (
    id: VersionControlId
  ) => Effect.Effect<
    VersionedMultiDocumentProject,
    RepositoryError | NotFoundError | MigrationError,
    never
  >;
  listProjectDocuments: (
    id: VersionControlId
  ) => Effect.Effect<
    ArtifactMetaData[],
    RepositoryError | NotFoundError | MigrationError,
    never
  >;
  addDocumentToProject: (
    args: AddDocumentToMultiDocumentProjectArgs
  ) => Effect.Effect<void, RepositoryError | NotFoundError, never>;
  deleteDocumentFromProject: (
    args: DeleteDocumentFromMultiDocumentProjectArgs
  ) => Effect.Effect<void, RepositoryError | NotFoundError, never>;
  findDocumentInProject: (
    args: FindDocumentInMultiDocumentProjectArgs
  ) => Effect.Effect<
    VersionControlId,
    RepositoryError | NotFoundError | MigrationError,
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
