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
import {
  type Branch,
  type MergeConflictInfo,
  MigrationError,
} from '../../../../../modules/infrastructure/version-control';
import { type Email, type Username } from '../../../../auth';
import {
  DataIntegrityError as VersionedProjectDataIntegrityError,
  MissingProjectMetadataError as VersionedProjectMissingProjectMetadataError,
  NotFoundError as VersionedProjectNotFoundError,
  RepositoryError as VersionedProjectRepositoryError,
  ValidationError as VersionedProjectValidationError,
} from '../../errors';
import { type ProjectId, type RemoteProjectInfo } from '../../models';
import { MultiDocumentProjectStore } from './multi-document-project-store';

type UserInfo = {
  username: Username | null;
  email: Email | null;
};

export type OpenOrCreateMultiDocumentProjectDeps = {
  filesystem: Filesystem;
};

export type OpenOrCreateMultiDocumentProjectArgs = UserInfo & {
  cloneUrl?: string;
  authToken?: string;
};

export type OpenOrCreateMultiDocumentProjectResult = {
  versionedProjectStore: MultiDocumentProjectStore;
  versionedDocumentStore: VersionedDocumentStore;
  projectId: ProjectId;
  directory: Directory;
  currentBranch: Branch;
  mergeConflictInfo: MergeConflictInfo | null;
  remoteProjects: RemoteProjectInfo[];
};

export type OpenMultiDocumentProjectByIdDeps = {
  filesystem: Filesystem;
};

export type OpenMultiDocumentProjectByIdArgs = UserInfo & {
  projectId: ProjectId;
  directoryPath: string;
};

export type OpenMultiDocumentProjectByIdResult = {
  versionedProjectStore: MultiDocumentProjectStore;
  versionedDocumentStore: VersionedDocumentStore;
  projectId: ProjectId;
  directory: Directory;
  currentBranch: Branch;
  mergeConflictInfo: MergeConflictInfo | null;
  remoteProjects: RemoteProjectInfo[];
};

export type MultiDocumentProjectStoreManager = {
  openOrCreateMultiDocumentProject: (
    deps: OpenOrCreateMultiDocumentProjectDeps
  ) => (
    args: OpenOrCreateMultiDocumentProjectArgs
  ) => Effect.Effect<
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
