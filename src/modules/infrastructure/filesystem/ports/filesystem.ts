import * as Effect from 'effect/Effect';

import {
  AbortError,
  AccessControlError,
  DataIntegrityError,
  NotFoundError,
  RepositoryError,
} from '../errors';
import type { Directory, File } from '../types';

export type OpenFileArgs = {
  extensions: Array<string>;
};

export type CreateNewFileArgs = {
  suggestedName?: string;
  extensions: Array<string>;
  parentDirectory?: Directory;
  content?: string | Uint8Array;
};

export type ListDirectoryFilesArgs = {
  path: string;
  extensions?: Array<string>;
  useRelativePath?: boolean;
};

export type GetRelativePathArgs = {
  path: string;
  relativeTo: string;
};

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
    args: ListDirectoryFilesArgs
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
    args: CreateNewFileArgs
  ) => Effect.Effect<File, AbortError | NotFoundError | RepositoryError, never>;
  openFile: (
    args: OpenFileArgs
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
  getRelativePath: (
    args: GetRelativePathArgs
  ) => Effect.Effect<string, NotFoundError | RepositoryError, never>;
};
