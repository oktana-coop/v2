import * as Effect from 'effect/Effect';

import { type VersionControlId } from '../../version-control';
import { NotFoundError, RepositoryError } from '../errors';
import type {
  ArtifactMetaData,
  Project,
  VersionedProject,
  VersionedProjectHandle,
} from '../models';

export type CreateProjectArgs = {
  path: string;
  artifacts: Project['artifacts'];
};

export type CreateDocumentArgs = {
  title: string;
  name: string;
  path: string;
  content: string | null;
  projectId: VersionControlId | null;
};

export type AddArtifactToProjectArgs = {
  artifactId: VersionControlId;
  name: string;
  path: string;
  projectId: VersionControlId;
};

export type DeleteArtifactFromProjectArgs = {
  projectId: VersionControlId;
  artifactId: VersionControlId;
};

export type FindArtifactInProjectArgs = {
  projectId: VersionControlId;
  artifactPath: string;
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
  listProjectArtifacts: (
    id: VersionControlId
  ) => Effect.Effect<
    ArtifactMetaData[],
    RepositoryError | NotFoundError,
    never
  >;
  addArtifactToProject: (
    args: AddArtifactToProjectArgs
  ) => Effect.Effect<void, RepositoryError | NotFoundError, never>;
  deleteArtifactFromProject: (
    args: DeleteArtifactFromProjectArgs
  ) => Effect.Effect<void, RepositoryError | NotFoundError, never>;
  findArtifactInProject: (
    args: FindArtifactInProjectArgs
  ) => Effect.Effect<VersionControlId, RepositoryError | NotFoundError, never>;
  getProjectFromHandle: (
    handle: VersionedProjectHandle
  ) => Effect.Effect<VersionedProject, RepositoryError | NotFoundError, never>;
};
