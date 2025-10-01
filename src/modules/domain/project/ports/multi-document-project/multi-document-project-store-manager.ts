import * as Effect from 'effect/Effect';

import {
  NotFoundError as VersionedDocumentNotFoundError,
  RepositoryError as VersionedDocumentRepositoryError,
  VersionedDocumentStore,
} from '../../../../../modules/domain/rich-text';
import {
  AbortError as FilesystemAbortError,
  AccessControlError as FilesystemAccessControlError,
  DataIntegrityError as FilesystemDataIntegrityError,
  type Directory,
  type Filesystem,
  NotFoundError as FilesystemNotFoundError,
  RepositoryError as FilesystemRepositoryError,
} from '../../../../../modules/infrastructure/filesystem';
import {
  MigrationError,
  type VersionControlId,
} from '../../../../../modules/infrastructure/version-control';
import {
  DataIntegrityError as VersionedProjectDataIntegrityError,
  MissingProjectMetadataError as VersionedProjectMissingProjectMetadataError,
  NotFoundError as VersionedProjectNotFoundError,
  RepositoryError as VersionedProjectRepositoryError,
} from '../../errors';
import { MultiDocumentProjectStore } from './multi-document-project-store';

export type OpenOrCreateMultiDocumentProjectDeps = {
  openDirectory: Filesystem['openDirectory'];
  listDirectoryFiles: Filesystem['listDirectoryFiles'];
  readFile: Filesystem['readFile'];
  writeFile: Filesystem['writeFile'];
  assertWritePermissionForDirectory: Filesystem['assertWritePermissionForDirectory'];
};

export type OpenOrCreateMultiDocumentProjectResult = {
  versionedProjectStore: MultiDocumentProjectStore;
  versionedDocumentStore: VersionedDocumentStore;
  projectId: VersionControlId;
  directory: Directory;
};

export type OpenMultiDocumentProjectByIdDeps = {
  listDirectoryFiles: Filesystem['listDirectoryFiles'];
  readFile: Filesystem['readFile'];
  getDirectory: Filesystem['getDirectory'];
};

export type OpenMultiDocumentProjectByIdArgs = {
  projectId: VersionControlId;
  directoryPath: string;
};

export type OpenMultiDocumentProjectByIdResult = {
  versionedProjectStore: MultiDocumentProjectStore;
  versionedDocumentStore: VersionedDocumentStore;
  projectId: VersionControlId;
  directory: Directory;
};

export type MultiDocumentProjectStoreManager = {
  openOrCreateMultiDocumentProject: (
    deps: OpenOrCreateMultiDocumentProjectDeps
  ) => () => Effect.Effect<
    OpenOrCreateMultiDocumentProjectResult,
    | FilesystemAbortError
    | FilesystemAccessControlError
    | FilesystemDataIntegrityError
    | FilesystemNotFoundError
    | FilesystemRepositoryError
    | VersionedProjectRepositoryError
    | VersionedProjectNotFoundError
    | VersionedProjectDataIntegrityError
    | VersionedDocumentRepositoryError
    | VersionedDocumentNotFoundError
    | MigrationError,
    never
  >;
  openMultiDocumentProjectById: (
    deps: OpenMultiDocumentProjectByIdDeps
  ) => (
    args: OpenMultiDocumentProjectByIdArgs
  ) => Effect.Effect<
    OpenMultiDocumentProjectByIdResult,
    | FilesystemAccessControlError
    | FilesystemDataIntegrityError
    | FilesystemNotFoundError
    | FilesystemRepositoryError
    | VersionedProjectMissingProjectMetadataError
    | VersionedProjectRepositoryError
    | VersionedProjectNotFoundError
    | VersionedProjectDataIntegrityError
    | VersionedDocumentRepositoryError
    | VersionedDocumentNotFoundError
    | MigrationError,
    never
  >;
};
