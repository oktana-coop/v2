import {
  type VersionControlId,
  type VersionedArtifact,
  type VersionedArtifactHandle,
} from '../../../../modules/infrastructure/version-control';

export type BaseArtifactMetaData = {
  versionControlId: VersionControlId;
  name: string;
};

export type ArtifactMetaData = BaseArtifactMetaData & {
  // TODO: use relative path to project directory in this model
  path: string;
};

export type Project = {
  path: string;
  documents: Record<VersionControlId, ArtifactMetaData>;
};

export type VersionedProject = VersionedArtifact<Project>;

export type VersionedProjectHandle = VersionedArtifactHandle<Project>;

export type SingleDocumentProject = {
  document: BaseArtifactMetaData;
  assets: Record<VersionControlId, BaseArtifactMetaData>;
};

export type SingleDocumentProjectHandle =
  VersionedArtifactHandle<SingleDocumentProject>;
