import * as Effect from 'effect/Effect';

import {
  AbortError as FilesystemAbortError,
  type Filesystem,
  NotFoundError as FilesystemNotFoundError,
  RepositoryError as FilesystemRepositoryError,
} from '../../../../../modules/infrastructure/filesystem';
import { type VersionedDocumentStore } from '../../../rich-text';
import { RepositoryError as ProjectStoreRepositoryError } from '../../errors';
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
  filePath?: string;
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
    | ProjectStoreRepositoryError,
    never
  >;
};
