import {
  type VersionControlId,
  type VersionedArtifact,
  type VersionedArtifactHandle,
} from '../../../../modules/infrastructure/version-control';

export type ArtifactMetaData = {
  versionControlId: VersionControlId;
  name: string;
  // TODO: use relative path to project directory in this model
  path: string;
};

export type Project = {
  path: string;
  documents: Record<VersionControlId, ArtifactMetaData>;
};

export type VersionedProject = VersionedArtifact<Project>;

export type VersionedProjectHandle = VersionedArtifactHandle<Project>;
