import {
  type ResolvedArtifactId,
  type VersionedArtifact,
  versionedArtifactTypes,
} from '../../../../../modules/infrastructure/version-control';
import { type ArtifactMetaData } from '../project-artifacts';

export const CURRENT_PROJECT_SCHEMA_VERSION = 1;

export type Project = {
  type: typeof versionedArtifactTypes.PROJECT;
  schemaVersion: number;
  path: string;
  documents: Record<ResolvedArtifactId, ArtifactMetaData>;
  assets: Record<ResolvedArtifactId, ArtifactMetaData>;
};

export type VersionedProject = VersionedArtifact<Project>;
