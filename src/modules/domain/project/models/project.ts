import {
  type ResolvedArtifactId,
  type VersionedArtifact,
  type VersionedArtifactHandle,
  versionedArtifactTypes,
} from '../../../../modules/infrastructure/version-control';
import { type ProjectId } from './project-id';

export const CURRENT_MULTI_DOCUMENT_PROJECT_SCHEMA_VERSION = 1;
export const CURRENT_SINGLE_DOCUMENT_PROJECT_SCHEMA_VERSION = 1;

export type BaseArtifactMetaData = {
  id: ResolvedArtifactId;
};

export type ArtifactMetaData = BaseArtifactMetaData & {
  name: string;
  path: string;
};

export type MultiDocumentProject = {
  type: typeof versionedArtifactTypes.MULTI_DOCUMENT_PROJECT;
  schemaVersion: number;
  path: string;
  documents: Record<ResolvedArtifactId, ArtifactMetaData>;
};

export type VersionedMultiDocumentProject =
  VersionedArtifact<MultiDocumentProject>;

export type VersionedMultiDocumentProjectHandle =
  VersionedArtifactHandle<MultiDocumentProject>;

export type ResolvedMultiDocumentProject = {
  id: ProjectId;
  project: VersionedMultiDocumentProject;
  handle: VersionedMultiDocumentProjectHandle | null;
};

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

export type ResolvedSingleDocumentProject = {
  id: ProjectId;
  project: VersionedSingleDocumentProject;
  handle: VersionedSingleDocumentProjectHandle | null;
};
