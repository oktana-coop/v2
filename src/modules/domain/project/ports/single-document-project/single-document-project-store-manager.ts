import * as Effect from 'effect/Effect';

import {
  AbortError as FilesystemAbortError,
  type File,
  type Filesystem,
  NotFoundError as FilesystemNotFoundError,
  RepositoryError as FilesystemRepositoryError,
} from '../../../../../modules/infrastructure/filesystem';
import {
  type Branch,
  MigrationError,
  type ResolvedArtifactId,
} from '../../../../../modules/infrastructure/version-control';
import {
  RepositoryError as VersionedDocumentRepositoryError,
  ValidationError as VersionedDocumentValidationError,
  type VersionedDocumentStore,
} from '../../../rich-text';
import {
  NotFoundError as VersionedProjectNotFoundError,
  RepositoryError as VersionedProjectRepositoryError,
  ValidationError as VersionedProjectValidationError,
} from '../../errors';
import { type ProjectId } from '../../models';
import { type SingleDocumentProjectStore } from './single-document-project-store';

export type SetupSingleDocumentProjectStoreDeps = {
  filesystem: Filesystem;
};

export type SetupSingleDocumentProjectStoreArgs = {
  name?: string;
};

export type SetupSingleDocumentProjectStoreResult = {
  versionedProjectStore: SingleDocumentProjectStore;
  versionedDocumentStore: VersionedDocumentStore;
  projectId: ProjectId;
  documentId: ResolvedArtifactId;
  currentBranch: Branch;
  file: File | null;
  name: string | null;
};

export type OpenSingleDocumentProjectStoreDeps = {
  filesystem: Filesystem;
};

export type OpenSingleDocumentProjectStoreArgs = {
  fromFile?: File;
  projectId?: ProjectId;
};

export type OpenSingleDocumentProjectStoreResult = {
  versionedProjectStore: SingleDocumentProjectStore;
  versionedDocumentStore: VersionedDocumentStore;
  projectId: ProjectId;
  documentId: ResolvedArtifactId;
  currentBranch: Branch;
  file: File | null;
  name: string | null;
};

export type SingleDocumentProjectStoreManager = {
  setupSingleDocumentProjectStore: (
    deps: SetupSingleDocumentProjectStoreDeps
  ) => (
    args: SetupSingleDocumentProjectStoreArgs
  ) => Effect.Effect<
    SetupSingleDocumentProjectStoreResult,
    | FilesystemAbortError
    | FilesystemNotFoundError
    | FilesystemRepositoryError
    | VersionedProjectRepositoryError
    | VersionedDocumentRepositoryError
    | VersionedDocumentValidationError
    | VersionedProjectValidationError,
    never
  >;
  openSingleDocumentProjectStore: (
    deps: OpenSingleDocumentProjectStoreDeps
  ) => (
    args: OpenSingleDocumentProjectStoreArgs
  ) => Effect.Effect<
    OpenSingleDocumentProjectStoreResult,
    | FilesystemAbortError
    | FilesystemRepositoryError
    | VersionedProjectRepositoryError
    | VersionedProjectNotFoundError
    | VersionedProjectValidationError
    | MigrationError,
    never
  >;
};
