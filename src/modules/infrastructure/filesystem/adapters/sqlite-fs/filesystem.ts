import path from 'node:path';

import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import { mapErrorTo } from '../../../../../utils/errors';
import { filesystemItemTypes } from '../../constants/filesystem-item-types';
import {
  DataIntegrityError,
  NotFoundError,
  RepositoryError,
} from '../../errors';
import { type Filesystem } from '../../ports/filesystem';
import { type File, isBinaryFile, isTextFile } from '../../types';
import { NodeLikeFsApi } from './node-like-sqlite-fs';
import { isNodeError } from './utils';

export const createAdapter = (fs: NodeLikeFsApi): Filesystem => {
  const openDirectory: Filesystem['openDirectory'] = () =>
    Effect.fail(
      new RepositoryError('Cannot open a directory in the SQLite fs adapter')
    );

  const getDirectory: Filesystem['getDirectory'] = (directoryPath: string) =>
    pipe(
      Effect.tryPromise({
        try: () => fs.stat(directoryPath),
        catch: (err: unknown) => {
          if (isNodeError(err)) {
            switch (err.code) {
              case 'ENOENT':
                return new NotFoundError(
                  `Directory ${directoryPath} does not exist`
                );
              default:
                return new RepositoryError(err.message);
            }
          }

          return new RepositoryError(
            `Unknown when trying to access directory ${directoryPath}`
          );
        },
      }),
      Effect.flatMap((stats) =>
        stats.isDirectory()
          ? Effect.succeed({
              type: filesystemItemTypes.DIRECTORY,
              name: path.basename(directoryPath),
              path: directoryPath,
              permissionState: 'granted', // TODO: Replace with constant
            })
          : Effect.fail(
              new NotFoundError(`Directory ${directoryPath} does not exist`)
            )
      )
    );

  const listDirectoryFiles: Filesystem['listDirectoryFiles'] = ({
    path: directoryPath,
    useRelativePath,
  }) =>
    pipe(
      Effect.tryPromise({
        try: () => fs.readdir(directoryPath),
        catch: (err: unknown) => {
          if (isNodeError(err)) {
            switch (err.code) {
              case 'ENOENT':
              case 'ENODIR':
                return new NotFoundError(
                  `Directory ${directoryPath} does not exist`
                );
              default:
                return new RepositoryError(err.message);
            }
          }

          return new RepositoryError(
            `Unknown when trying to access directory ${directoryPath}`
          );
        },
      }),
      Effect.map((dirEntries) => {
        const files = dirEntries.map((relativePath) => {
          const file: File = {
            type: filesystemItemTypes.FILE,
            name: relativePath,
            path: useRelativePath
              ? relativePath
              : path.join(directoryPath, relativePath),
          };

          return file;
        });

        return files;
      })
    );

  // In the SQLite fs adapter, we have a flat structure and no real directories,
  // so we can just reuse the listDirectoryFiles implementation.
  const listDirectoryTree: Filesystem['listDirectoryTree'] = listDirectoryFiles;

  const requestPermissionForDirectory: Filesystem['requestPermissionForDirectory'] =
    (directoryPath: string) =>
      pipe(
        getDirectory(directoryPath),
        Effect.flatMap(() => Effect.succeed('granted'))
      );

  const assertWritePermissionForDirectory: Filesystem['assertWritePermissionForDirectory'] =
    (directoryPath: string) =>
      pipe(getDirectory(directoryPath), Effect.as(undefined));

  const createNewFile: Filesystem['createNewFile'] = () =>
    Effect.fail(
      new RepositoryError('Cannot create a new file in the SQLite fs adapter')
    );

  const openFile: Filesystem['openFile'] = () =>
    Effect.fail(
      new RepositoryError('Cannot open a file in the SQLite fs adapter')
    );

  const writeFile: Filesystem['writeFile'] = ({ path: filePath, content }) =>
    Effect.tryPromise({
      try: () => fs.writeFile(filePath, content),
      catch: mapErrorTo(RepositoryError, 'Node filesystem API error'),
    });

  const readFile: (args: {
    path: string;
    encoding?: BufferEncoding;
  }) => Effect.Effect<File, NotFoundError | RepositoryError, never> = ({
    path: filePath,
    encoding,
  }) =>
    pipe(
      Effect.tryPromise<string | Buffer, NotFoundError | RepositoryError>({
        try: () =>
          encoding
            ? fs.readFile(filePath, { encoding })
            : fs.readFile(filePath),
        catch: (err: unknown) => {
          if (isNodeError(err)) {
            switch (err.code) {
              case 'ENOENT':
                return new NotFoundError(
                  `File in path ${filePath} does not exist`
                );
              default:
                return new RepositoryError(err.message);
            }
          }

          return new RepositoryError(
            `Error reading file with path ${filePath}`
          );
        },
      }),
      Effect.map((content) => ({
        type: filesystemItemTypes.FILE,
        name: path.basename(filePath),
        path: filePath,
        content,
      }))
    );

  const readBinaryFile: Filesystem['readBinaryFile'] = (filePath) =>
    pipe(
      readFile({ path: filePath }),
      Effect.flatMap((file) =>
        isBinaryFile(file)
          ? Effect.succeed(file)
          : Effect.fail(
              new DataIntegrityError(
                'Expected a binary file but got a text one'
              )
            )
      )
    );

  const readTextFile: Filesystem['readTextFile'] = (filePath) =>
    pipe(
      readFile({ path: filePath, encoding: 'utf8' }),
      Effect.flatMap((file) =>
        isTextFile(file)
          ? Effect.succeed(file)
          : Effect.fail(
              new DataIntegrityError('Expected a text file but got a binary')
            )
      )
    );

  const deleteFile: Filesystem['deleteFile'] = ({ path: filePath }) =>
    Effect.tryPromise({
      try: () => fs.unlink(filePath),
      catch: (err: unknown) => {
        if (isNodeError(err)) {
          switch (err.code) {
            case 'ENOENT':
              return new NotFoundError(
                `File in path ${filePath} does not exist`
              );
            default:
              return new RepositoryError(err.message);
          }
        }

        return new RepositoryError(`Error reading file with path ${filePath}`);
      },
    });

  // Inside the SQLite filesystem, we use posix paths independently of the host OS.
  const getRelativePath: Filesystem['getRelativePath'] = ({
    path: descendantPath,
    relativeTo,
  }) =>
    Effect.try({
      try: () => path.posix.relative(relativeTo, descendantPath),
      catch: mapErrorTo(
        RepositoryError,
        'Could not resolve path relative to directory'
      ),
    });

  // Inside the SQLite filesystem, we use posix paths independently of the host OS.
  const getAbsolutePath: Filesystem['getAbsolutePath'] = ({
    path: descendantPath,
    dirPath,
  }) =>
    Effect.try({
      try: () => path.posix.join(dirPath, descendantPath),
      catch: mapErrorTo(
        RepositoryError,
        'Could not join directory path with relative path'
      ),
    });

  return {
    openDirectory,
    getDirectory,
    listDirectoryFiles,
    listDirectoryTree,
    requestPermissionForDirectory,
    assertWritePermissionForDirectory,
    createNewFile,
    openFile,
    writeFile,
    readBinaryFile,
    readTextFile,
    deleteFile,
    getRelativePath,
    getAbsolutePath,
  };
};
