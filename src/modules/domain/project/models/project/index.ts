import {
  type ResolvedArtifactId,
  type VersionedArtifact,
  type VersionedArtifactHandle,
  versionedArtifactTypes,
} from '../../../../../modules/infrastructure/version-control';
import { type ProjectId } from '../project-id';

export const CURRENT_PROJECT_SCHEMA_VERSION = 1;

export type BaseArtifactMetaData = {
  id: ResolvedArtifactId;
};

export type ArtifactMetaData = BaseArtifactMetaData & {
  name: string;
  path: string;
};

export type Project = {
  type: typeof versionedArtifactTypes.PROJECT;
  schemaVersion: number;
  path: string;
  documents: Record<ResolvedArtifactId, ArtifactMetaData>;
  assets: Record<ResolvedArtifactId, ArtifactMetaData>;
};

export type VersionedProject = VersionedArtifact<Project>;

export type VersionedProjectHandle = VersionedArtifactHandle<Project>;

export type ResolvedProject = {
  id: ProjectId;
  project: VersionedProject;
  handle: VersionedProjectHandle | null;
};
