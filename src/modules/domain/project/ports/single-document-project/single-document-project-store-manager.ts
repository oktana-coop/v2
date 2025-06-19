import * as Effect from 'effect/Effect';

import {
  AbortError as FilesystemAbortError,
  type File,
  type Filesystem,
  NotFoundError as FilesystemNotFoundError,
  RepositoryError as FilesystemRepositoryError,
} from '../../../../../modules/infrastructure/filesystem';
import { type VersionControlId } from '../../../../../modules/infrastructure/version-control';
import {
  RepositoryError as VersionedDocumentRepositoryError,
  type VersionedDocumentStore,
} from '../../../rich-text';
import {
  NotFoundError as VersionedProjectNotFoundError,
  RepositoryError as VersionedProjectRepositoryError,
  ValidationError as VersionedProjectValidationError,
} from '../../errors';
import { type SingleDocumentProjectStore } from './single-document-project-store';

export type SetupSingleDocumentProjectStoreDeps = {
  createNewFile: Filesystem['createNewFile'];
};

export type SetupSingleDocumentProjectStoreArgs = {
  name?: string;
};

export type SetupSingleDocumentProjectStoreResult = {
  versionedProjectStore: SingleDocumentProjectStore;
  versionedDocumentStore: VersionedDocumentStore;
  projectId: VersionControlId;
  documentId: VersionControlId;
  file: File | null;
  name: string | null;
};

export type OpenSingleDocumentProjectStoreDeps = {
  openFile: Filesystem['openFile'];
};

export type OpenSingleDocumentProjectStoreArgs = {
  fromFile?: File;
  projectId?: VersionControlId;
};

export type OpenSingleDocumentProjectStoreResult = {
  versionedProjectStore: SingleDocumentProjectStore;
  versionedDocumentStore: VersionedDocumentStore;
  projectId: VersionControlId;
  documentId: VersionControlId;
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
    | VersionedProjectValidationError,
    never
  >;
};
