import {
  type ArtifactId,
  type VersionedArtifact,
} from '../../../../../modules/infrastructure/version-control';
import { type DocumentMetaData } from '../project-artifacts';

export const CURRENT_PROJECT_SCHEMA_VERSION = 1;

export type Project = {
  schemaVersion: number;
  path: string;
  documents: Record<ArtifactId, DocumentMetaData>;
};

export type VersionedProject = VersionedArtifact<Project>;
