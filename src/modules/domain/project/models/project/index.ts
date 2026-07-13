import {
  type ArtifactId,
  type VersionedArtifact,
  versionedArtifactTypes,
} from '../../../../../modules/infrastructure/version-control';
import { type ArtifactMetaData } from '../project-artifacts';

export const CURRENT_PROJECT_SCHEMA_VERSION = 1;

export type Project = {
  type: typeof versionedArtifactTypes.PROJECT;
  schemaVersion: number;
  path: string;
  documents: Record<ArtifactId, ArtifactMetaData>;
  assets: Record<ArtifactId, ArtifactMetaData>;
};

export type VersionedProject = VersionedArtifact<Project>;
