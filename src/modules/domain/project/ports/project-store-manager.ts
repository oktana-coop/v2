import * as Effect from 'effect/Effect';

import {
  NotFoundError as VersionedDocumentNotFoundError,
  RepositoryError as VersionedDocumentRepositoryError,
  ValidationError as VersionedDocumentValidationError,
} from '../../../../modules/domain/rich-text';
import {
  AbortError as FilesystemAbortError,
  AccessControlError as FilesystemAccessControlError,
  DataIntegrityError as FilesystemDataIntegrityError,
  type Directory,
  type Filesystem,
  NotFoundError as FilesystemNotFoundError,
  RepositoryError as FilesystemRepositoryError,
} from '../../../../modules/infrastructure/filesystem';
import {
  type Branch,
  type MergeConflictInfo,
  MigrationError,
} from '../../../../modules/infrastructure/version-control';
import { type Email, type Username } from '../../../auth';
import {
  DataIntegrityError as VersionedProjectDataIntegrityError,
  MissingProjectMetadataError as VersionedProjectMissingProjectMetadataError,
  NotFoundError as VersionedProjectNotFoundError,
  RepositoryError as VersionedProjectRepositoryError,
  ValidationError as VersionedProjectValidationError,
} from '../errors';
import { type ProjectId, type RemoteProjectInfo } from '../models';
import { ProjectStore } from './project-store';

type UserInfo = {
  username: Username | null;
  email: Email | null;
};

export type OpenOrCreateProjectDeps = {
  filesystem: Filesystem;
};

export type OpenOrCreateProjectArgs = UserInfo & {
  cloneUrl?: string;
  authToken?: string;
};

export type OpenOrCreateProjectResult = {
  projectStore: ProjectStore;
  projectId: ProjectId;
  directory: Directory;
  currentBranch: Branch;
  mergeConflictInfo: MergeConflictInfo | null;
  remoteProjects: RemoteProjectInfo[];
};

export type OpenProjectByIdDeps = {
  filesystem: Filesystem;
};

export type OpenProjectByIdArgs = UserInfo & {
  projectId: ProjectId;
  directoryPath: string;
};

export type OpenProjectByIdResult = {
  projectStore: ProjectStore;
  projectId: ProjectId;
  directory: Directory;
  currentBranch: Branch;
  mergeConflictInfo: MergeConflictInfo | null;
  remoteProjects: RemoteProjectInfo[];
};

export type ProjectStoreManager = {
  openOrCreateProject: (
    deps: OpenOrCreateProjectDeps
  ) => (
    args: OpenOrCreateProjectArgs
  ) => Effect.Effect<
    OpenOrCreateProjectResult,
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
  openProjectById: (
    deps: OpenProjectByIdDeps
  ) => (
    args: OpenProjectByIdArgs
  ) => Effect.Effect<
    OpenProjectByIdResult,
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
