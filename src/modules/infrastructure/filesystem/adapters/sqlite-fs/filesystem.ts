import path from 'node:path';

import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import { mapErrorTo } from '../../../../../utils/errors';
import { filesystemItemTypes } from '../../constants/filesystem-item-types';
import {
  AlreadyExistsError,
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

  const rename: Filesystem['rename'] = ({ oldPath, newPath }) =>
    Effect.tryPromise({
      try: () => fs.rename(oldPath, newPath),
      catch: (err: unknown) => {
        if (isNodeError(err)) {
          switch (err.code) {
            case 'EEXIST':
              return new AlreadyExistsError(
                `A file already exists at path ${newPath}`
              );
            case 'ENOENT':
              return new NotFoundError(
                `File at path ${oldPath} does not exist`
              );
            default:
              return new RepositoryError(err.message);
          }
        }

        return new RepositoryError(`Error renaming file ${oldPath}`);
      },
    });

  // Inside the SQLite filesystem, we use posix paths independently of the host OS.
  const getRenamedPath: Filesystem['getRenamedPath'] = ({ oldPath, newName }) =>
    Effect.try({
      try: () => {
        const dir = path.posix.dirname(oldPath);
        return path.posix.format({
          dir: dir === '.' ? '' : dir,
          name: newName,
          ext: path.posix.extname(oldPath),
        });
      },
      catch: mapErrorTo(RepositoryError, 'Could not compute renamed path'),
    });

  // Inside the SQLite filesystem, we use posix paths independently of the host OS.
  const isDescendantPath: Filesystem['isDescendantPath'] = ({
    parent,
    possibleDescendant,
  }) =>
    Effect.try({
      try: () => {
        const rel = path.posix.relative(
          path.posix.resolve(parent),
          path.posix.resolve(possibleDescendant)
        );

        return (
          rel !== '' &&
          !path.posix.isAbsolute(rel) &&
          !rel.startsWith('..' + path.posix.sep) &&
          rel !== '..'
        );
      },
      catch: mapErrorTo(RepositoryError, 'Could not check path ancestry'),
    });

  const deleteDirectory: Filesystem['deleteDirectory'] = ({ path: dirPath }) =>
    Effect.tryPromise({
      try: () => fs.rmdir(dirPath),
      catch: (err: unknown) => {
        if (isNodeError(err)) {
          switch (err.code) {
            case 'ENOENT':
              return new NotFoundError(
                `Directory at path ${dirPath} does not exist`
              );
            default:
              return new RepositoryError(err.message);
          }
        }

        return new RepositoryError(
          `Error deleting directory at path ${dirPath}`
        );
      },
    });

  // Directories are implicit from filenames in the SQLite filesystem,
  // so creating a directory explicitly is not supported.
  const createDirectory: Filesystem['createDirectory'] = () =>
    Effect.fail(
      new RepositoryError(
        'Creating directories is not supported in the SQLite filesystem.'
      )
    );

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
    deleteDirectory,
    rename,
    getRelativePath,
    getAbsolutePath,
    getRenamedPath,
    isDescendantPath,
    createDirectory,
  };
};
