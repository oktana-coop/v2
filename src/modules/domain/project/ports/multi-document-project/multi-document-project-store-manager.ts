import * as Effect from 'effect/Effect';

import {
  NotFoundError as VersionedDocumentNotFoundError,
  RepositoryError as VersionedDocumentRepositoryError,
  ValidationError as VersionedDocumentValidationError,
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
import { MigrationError } from '../../../../../modules/infrastructure/version-control';
import {
  DataIntegrityError as VersionedProjectDataIntegrityError,
  MissingProjectMetadataError as VersionedProjectMissingProjectMetadataError,
  NotFoundError as VersionedProjectNotFoundError,
  RepositoryError as VersionedProjectRepositoryError,
  ValidationError as VersionedProjectValidationError,
} from '../../errors';
import { type ProjectId } from '../../models';
import { MultiDocumentProjectStore } from './multi-document-project-store';

export type OpenOrCreateMultiDocumentProjectDeps = {
  filesystem: Filesystem;
};

export type OpenOrCreateMultiDocumentProjectResult = {
  versionedProjectStore: MultiDocumentProjectStore;
  versionedDocumentStore: VersionedDocumentStore;
  projectId: ProjectId;
  directory: Directory;
};

export type OpenMultiDocumentProjectByIdDeps = {
  filesystem: Filesystem;
};

export type OpenMultiDocumentProjectByIdArgs = {
  projectId: ProjectId;
  directoryPath: string;
};

export type OpenMultiDocumentProjectByIdResult = {
  versionedProjectStore: MultiDocumentProjectStore;
  versionedDocumentStore: VersionedDocumentStore;
  projectId: ProjectId;
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
    | VersionedProjectValidationError
    | VersionedDocumentRepositoryError
    | VersionedDocumentNotFoundError
    | VersionedDocumentValidationError
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
    | VersionedProjectValidationError
    | VersionedDocumentRepositoryError
    | VersionedDocumentNotFoundError
    | VersionedDocumentValidationError
    | MigrationError,
    never
  >;
};
