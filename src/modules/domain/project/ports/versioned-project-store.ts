import * as Effect from 'effect/Effect';

import { type VersionControlId } from '../../../../modules/infrastructure/version-control';
import { NotFoundError, RepositoryError } from '../errors';
import type {
  ArtifactMetaData,
  Project,
  VersionedProject,
  VersionedProjectHandle,
} from '../models';

export type CreateProjectArgs = {
  path: string;
  documents: Project['documents'];
};

export type AddDocumentToProjectArgs = {
  documentId: VersionControlId;
  name: string;
  path: string;
  projectId: VersionControlId;
};

export type DeleteDocumentFromProjectArgs = {
  projectId: VersionControlId;
  documentId: VersionControlId;
};

export type FindDocumentInProjectArgs = {
  projectId: VersionControlId;
  documentPath: string;
};

export type VersionedProjectStore = {
  createProject: (
    args: CreateProjectArgs
  ) => Effect.Effect<VersionControlId, RepositoryError, never>;
  findProjectById: (
    id: VersionControlId
  ) => Effect.Effect<
    VersionedProjectHandle,
    RepositoryError | NotFoundError,
    never
  >;
  listProjectDocuments: (
    id: VersionControlId
  ) => Effect.Effect<
    ArtifactMetaData[],
    RepositoryError | NotFoundError,
    never
  >;
  addDocumentToProject: (
    args: AddDocumentToProjectArgs
  ) => Effect.Effect<void, RepositoryError | NotFoundError, never>;
  deleteDocumentFromProject: (
    args: DeleteDocumentFromProjectArgs
  ) => Effect.Effect<void, RepositoryError | NotFoundError, never>;
  findDocumentInProject: (
    args: FindDocumentInProjectArgs
  ) => Effect.Effect<VersionControlId, RepositoryError | NotFoundError, never>;
  getProjectFromHandle: (
    handle: VersionedProjectHandle
  ) => Effect.Effect<VersionedProject, RepositoryError | NotFoundError, never>;
};
