import * as Effect from 'effect/Effect';

import {
  MigrationError,
  type VersionControlId,
} from '../../../../infrastructure/version-control';
import { NotFoundError, RepositoryError } from '../../errors';
import {
  type BaseArtifactMetaData,
  type VersionedSingleDocumentProject,
  type VersionedSingleDocumentProjectHandle,
} from '../../models';

export type CreateSingleDocumentProjectArgs = {
  documentMetaData: BaseArtifactMetaData;
  name: string | null;
};

export type SingleDocumentProjectStore = {
  createSingleDocumentProject: (
    args: CreateSingleDocumentProjectArgs
  ) => Effect.Effect<VersionControlId, RepositoryError, never>;
  findDocumentInProject: (
    projectId: VersionControlId
  ) => Effect.Effect<
    VersionControlId,
    RepositoryError | NotFoundError | MigrationError,
    never
  >;
  findProjectById: (
    projectId: VersionControlId
  ) => Effect.Effect<
    VersionedSingleDocumentProject,
    RepositoryError | NotFoundError | MigrationError,
    never
  >;
  getProjectFromHandle: (
    handle: VersionedSingleDocumentProjectHandle
  ) => Effect.Effect<
    VersionedSingleDocumentProject,
    RepositoryError | NotFoundError,
    never
  >;
  getProjectName: (
    projectId: VersionControlId
  ) => Effect.Effect<
    string | null,
    RepositoryError | NotFoundError | MigrationError,
    never
  >;
  disconnect: () => Effect.Effect<void, RepositoryError, never>;
};
