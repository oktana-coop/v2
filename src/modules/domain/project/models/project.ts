import {
  type VersionControlId,
  type VersionedArtifact,
  type VersionedArtifactHandle,
} from '../../../../modules/infrastructure/version-control';

export type BaseArtifactMetaData = {
  id: VersionControlId;
};

export type ArtifactMetaData = BaseArtifactMetaData & {
  // TODO: use relative path to project directory in this model
  name: string;
  path: string;
};

export type MultiDocumentProject = {
  path: string;
  documents: Record<VersionControlId, ArtifactMetaData>;
};

export type VersionedMultiDocumentProject =
  VersionedArtifact<MultiDocumentProject>;

export type VersionedMultiDocumentProjectHandle =
  VersionedArtifactHandle<MultiDocumentProject>;

export type SingleDocumentProject = {
  document: BaseArtifactMetaData;
  assets: Record<VersionControlId, BaseArtifactMetaData>;
  name: string | null;
};

export type VersionedSingleDocumentProject =
  VersionedArtifact<SingleDocumentProject>;

export type VersionedSingleDocumentProjectHandle =
  VersionedArtifactHandle<SingleDocumentProject>;
