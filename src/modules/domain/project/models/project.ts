import {
  type VersionControlId,
  type VersionedArtifact,
  type VersionedArtifactHandle,
  versionedArtifactTypes,
} from '../../../../modules/infrastructure/version-control';

export type BaseArtifactMetaData = {
  id: VersionControlId;
};

export type ArtifactMetaData = BaseArtifactMetaData & {
  name: string;
  path: string;
};

export type MultiDocumentProject = {
  type: typeof versionedArtifactTypes.MULTI_DOCUMENT_PROJECT;
  schemaVersion: string;
  path: string;
  documents: Record<VersionControlId, ArtifactMetaData>;
};

export type VersionedMultiDocumentProject =
  VersionedArtifact<MultiDocumentProject>;

export type VersionedMultiDocumentProjectHandle =
  VersionedArtifactHandle<MultiDocumentProject>;

export type SingleDocumentProject = {
  type: typeof versionedArtifactTypes.SINGLE_DOCUMENT_PROJECT;
  schemaVersion: string;
  document: BaseArtifactMetaData;
  name: string | null;
};

export type VersionedSingleDocumentProject =
  VersionedArtifact<SingleDocumentProject>;

export type VersionedSingleDocumentProjectHandle =
  VersionedArtifactHandle<SingleDocumentProject>;
