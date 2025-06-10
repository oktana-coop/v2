import * as Effect from 'effect/Effect';

import {
  AbortError as FilesystemAbortError,
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
} from '../../errors';
import { type SingleDocumentProjectStore } from './single-document-project-store';

export type SetupSingleDocumentProjectStoreDeps = {
  createNewFile: Filesystem['createNewFile'];
};

export type SetupSingleDocumentProjectStoreArgs = {
  suggestedName: string;
};

export type SetupSingleDocumentProjectStoreResult = {
  versionedProjectStore: SingleDocumentProjectStore;
  versionedDocumentStore: VersionedDocumentStore;
  projectId: VersionControlId;
  documentId: VersionControlId;
  filePath?: string;
};

export type OpenSingleDocumentProjectStoreArgs = {
  filePath: string;
};

export type OpenSingleDocumentProjectStoreResult = {
  versionedProjectStore: SingleDocumentProjectStore;
  versionedDocumentStore: VersionedDocumentStore;
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
    | VersionedDocumentRepositoryError,
    never
  >;
  openSingleDocumentProjectStore: (
    args: OpenSingleDocumentProjectStoreArgs
  ) => Effect.Effect<
    OpenSingleDocumentProjectStoreResult,
    VersionedProjectRepositoryError | VersionedProjectNotFoundError,
    never
  >;
};
