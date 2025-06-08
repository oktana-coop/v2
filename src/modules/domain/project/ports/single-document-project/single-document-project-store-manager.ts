import * as Effect from 'effect/Effect';

import {
  AbortError as FilesystemAbortError,
  type Filesystem,
  NotFoundError as FilesystemNotFoundError,
  RepositoryError as FilesystemRepositoryError,
} from '../../../../../modules/infrastructure/filesystem';
import { RepositoryError as ProjectStoreRepositoryError } from '../../errors';

export type SetupSingleDocumentProjectStoreDeps = {
  createNewFile: Filesystem['createNewFile'];
};

export type SetupSingleDocumentProjectStoreArgs = {
  suggestedName: string;
};

export type SingleDocumentProjectStoreManager = {
  setupSingleDocumentProjectStore: (
    deps: SetupSingleDocumentProjectStoreDeps
  ) => (
    args: SetupSingleDocumentProjectStoreArgs
  ) => Effect.Effect<
    void,
    | FilesystemAbortError
    | FilesystemNotFoundError
    | FilesystemRepositoryError
    | ProjectStoreRepositoryError,
    never
  >;
};
