import * as Effect from 'effect/Effect';

import {
  AbortError,
  AccessControlError,
  DataIntegrityError,
  NotFoundError,
  RepositoryError,
} from '../errors';
import type { Directory, File } from '../types';

export type Filesystem = {
  openDirectory: () => Effect.Effect<
    Directory,
    AbortError | RepositoryError,
    never
  >;
  getDirectory: (
    path: string
  ) => Effect.Effect<Directory, NotFoundError | RepositoryError, never>;
  listDirectoryFiles: (
    path: string
  ) => Effect.Effect<
    Array<File>,
    DataIntegrityError | NotFoundError | RepositoryError,
    never
  >;
  requestPermissionForDirectory: (
    path: string
  ) => Effect.Effect<
    PermissionState,
    NotFoundError | RepositoryError | AccessControlError,
    never
  >;
  assertWritePermissionForDirectory: (
    path: string
  ) => Effect.Effect<
    void,
    NotFoundError | RepositoryError | AccessControlError,
    never
  >;
  createNewFile: (
    suggestedName: string
  ) => Effect.Effect<File, AbortError | RepositoryError, never>;
  writeFile: (
    path: string,
    content: string
  ) => Effect.Effect<
    void,
    AccessControlError | NotFoundError | RepositoryError,
    never
  >;
  readFile: (
    path: string
  ) => Effect.Effect<
    File,
    AccessControlError | NotFoundError | RepositoryError,
    never
  >;
};
