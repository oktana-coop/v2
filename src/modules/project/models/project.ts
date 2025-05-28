import {
  type VersionControlId,
  type VersionedArtifact,
  type VersionedArtifactHandle,
} from '../../../modules/version-control';

export type DocumentMetaData = {
  versionControlId: VersionControlId;
  name: string;
  // TODO: use relative path to project directory in this model
  path: string;
};

export type Project = {
  path: string;
  documents: Record<VersionControlId, DocumentMetaData>;
};

export type VersionedProject = VersionedArtifact<Project>;

export type VersionedProjectHandle = VersionedArtifactHandle<Project>;
