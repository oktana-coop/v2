import * as Effect from 'effect/Effect';

import { type VersionControlId } from '../../../../infrastructure/version-control';
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
  ) => Effect.Effect<VersionControlId, RepositoryError | NotFoundError, never>;
  findProjectById: (
    projectId: VersionControlId
  ) => Effect.Effect<
    VersionedSingleDocumentProjectHandle,
    RepositoryError | NotFoundError,
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
  ) => Effect.Effect<string | null, RepositoryError | NotFoundError, never>;
};
