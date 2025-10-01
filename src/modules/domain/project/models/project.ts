import {
  type VersionControlId,
  type VersionedArtifact,
  type VersionedArtifactHandle,
  versionedArtifactTypes,
} from '../../../../modules/infrastructure/version-control';

export const CURRENT_MULTI_DOCUMENT_PROJECT_SCHEMA_VERSION = 1;
export const CURRENT_SINGLE_DOCUMENT_PROJECT_SCHEMA_VERSION = 1;

export type BaseArtifactMetaData = {
  id: VersionControlId;
};

export type ArtifactMetaData = BaseArtifactMetaData & {
  name: string;
  path: string;
};

export type MultiDocumentProject = {
  type: typeof versionedArtifactTypes.MULTI_DOCUMENT_PROJECT;
  schemaVersion: number;
  path: string;
  documents: Record<VersionControlId, ArtifactMetaData>;
};

export type VersionedMultiDocumentProject =
  VersionedArtifact<MultiDocumentProject>;

export type VersionedMultiDocumentProjectHandle =
  VersionedArtifactHandle<MultiDocumentProject>;

export type SingleDocumentProject = {
  type: typeof versionedArtifactTypes.SINGLE_DOCUMENT_PROJECT;
  schemaVersion: number;
  document: BaseArtifactMetaData;
  name: string | null;
};

export type VersionedSingleDocumentProject =
  VersionedArtifact<SingleDocumentProject>;

export type VersionedSingleDocumentProjectHandle =
  VersionedArtifactHandle<SingleDocumentProject>;
