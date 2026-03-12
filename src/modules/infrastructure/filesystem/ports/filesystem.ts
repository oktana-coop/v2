import * as Effect from 'effect/Effect';

import {
  AbortError,
  AccessControlError,
  AlreadyExistsError,
  DataIntegrityError,
  NotFoundError,
  RepositoryError,
} from '../errors';
import {
  type BinaryFile,
  type Directory,
  type File,
  type TextFile,
} from '../types';

export type OpenFileArgs = {
  extensions: Array<string>;
};

export type WriteFileArgs = {
  path: string;
  content: string | Uint8Array;
};

export type CreateNewFileArgs = {
  suggestedName?: string;
  extensions: Array<string>;
  parentDirectory?: Directory;
  content?: string | Uint8Array;
};

export type ListDirectoryFilesArgs = {
  path: string;
  includeHidden?: boolean;
  extensions?: Array<string>;
  useRelativePath?: boolean;
  recursive?: boolean;
};

export type ListDirectoryTreeArgs = {
  path: string;
  includeHidden?: boolean;
  depth?: number;
  extensions?: Array<string>;
  useRelativePathTo?: string;
};

export type DeleteFileArgs = {
  path: string;
  parentDirectory?: Directory;
};

export type RenameFileArgs = {
  oldPath: string;
  newPath: string;
};

export type CreateDirectoryArgs = {
  name: string;
  parentDirectory?: Directory;
};

export type GetRelativePathArgs = {
  path: string;
  relativeTo: string;
};

export type GetAbsolutePathArgs = {
  path: string;
  dirPath: string;
};

export type GetRenamedPathArgs = {
  oldPath: string;
  newName: string;
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
  listDirectoryTree: (
    args: ListDirectoryTreeArgs
  ) => Effect.Effect<
    Array<Directory | File>,
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
    args: WriteFileArgs
  ) => Effect.Effect<
    void,
    AccessControlError | NotFoundError | RepositoryError,
    never
  >;
  readBinaryFile: (
    path: string
  ) => Effect.Effect<
    BinaryFile,
    AccessControlError | NotFoundError | RepositoryError | DataIntegrityError,
    never
  >;
  readTextFile: (
    path: string
  ) => Effect.Effect<
    TextFile,
    AccessControlError | NotFoundError | RepositoryError | DataIntegrityError,
    never
  >;
  deleteFile: (
    args: DeleteFileArgs
  ) => Effect.Effect<
    void,
    AccessControlError | NotFoundError | RepositoryError,
    never
  >;
  renameFile: (
    args: RenameFileArgs
  ) => Effect.Effect<
    void,
    AlreadyExistsError | AccessControlError | NotFoundError | RepositoryError,
    never
  >;
  createDirectory: (
    args: CreateDirectoryArgs
  ) => Effect.Effect<Directory, NotFoundError | RepositoryError, never>;
  getRelativePath: (
    args: GetRelativePathArgs
  ) => Effect.Effect<string, RepositoryError, never>;
  getAbsolutePath: (
    args: GetAbsolutePathArgs
  ) => Effect.Effect<string, RepositoryError, never>;
  getRenamedPath: (
    args: GetRenamedPathArgs
  ) => Effect.Effect<string, RepositoryError, never>;
};
