import * as Effect from 'effect/Effect';

import {
  NotFoundError as VersionedDocumentNotFoundError,
  RepositoryError as VersionedDocumentRepositoryError,
} from '../../../../../modules/domain/rich-text';
import {
  AccessControlError as FilesystemAccessControlError,
  DataIntegrityError as FilesystemDataIntegrityError,
  type Filesystem,
  NotFoundError as FilesystemNotFoundError,
  RepositoryError as FilesystemRepositoryError,
} from '../../../../../modules/infrastructure/filesystem';
import { type VersionControlId } from '../../../../../modules/infrastructure/version-control';
import {
  DataIntegrityError as VersionedProjectDataIntegrityError,
  MissingIndexFileError as VersionedProjectMissingIndexFileError,
  NotFoundError as VersionedProjectNotFoundError,
  RepositoryError as VersionedProjectRepositoryError,
} from '../../errors';

export type OpenOrCreateMultiDocumentProjectDeps = {
  listDirectoryFiles: Filesystem['listDirectoryFiles'];
  readFile: Filesystem['readFile'];
  writeFile: Filesystem['writeFile'];
  assertWritePermissionForDirectory: Filesystem['assertWritePermissionForDirectory'];
};

export type OpenOrCreateMultiDocumentProjectArgs = {
  directoryPath: string;
};

export type OpenMultiDocumentProjectByIdDeps = {
  listDirectoryFiles: Filesystem['listDirectoryFiles'];
  readFile: Filesystem['readFile'];
  assertWritePermissionForDirectory: Filesystem['assertWritePermissionForDirectory'];
};

export type OpenMultiDocumentProjectByIdArgs = {
  projectId: VersionControlId;
  directoryPath: string;
};

export type MultiDocumentProjectStoreManager = {
  openOrCreateMultiDocumentProject: (
    deps: OpenOrCreateMultiDocumentProjectDeps
  ) => (
    args: OpenOrCreateMultiDocumentProjectArgs
  ) => Effect.Effect<
    VersionControlId,
    | FilesystemAccessControlError
    | FilesystemDataIntegrityError
    | FilesystemNotFoundError
    | FilesystemRepositoryError
    | VersionedProjectRepositoryError
    | VersionedProjectNotFoundError
    | VersionedProjectDataIntegrityError
    | VersionedDocumentRepositoryError
    | VersionedDocumentNotFoundError,
    never
  >;
  openMultiDocumentProjectById: (
    deps: OpenMultiDocumentProjectByIdDeps
  ) => (
    args: OpenMultiDocumentProjectByIdArgs
  ) => Effect.Effect<
    void,
    | FilesystemAccessControlError
    | FilesystemDataIntegrityError
    | FilesystemNotFoundError
    | FilesystemRepositoryError
    | VersionedProjectMissingIndexFileError
    | VersionedProjectRepositoryError
    | VersionedProjectNotFoundError
    | VersionedProjectDataIntegrityError
    | VersionedDocumentRepositoryError
    | VersionedDocumentNotFoundError,
    never
  >;
};
