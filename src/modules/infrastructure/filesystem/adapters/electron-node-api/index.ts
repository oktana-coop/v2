import { promises as fs } from 'node:fs';
import path from 'node:path';

import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import { dialog } from 'electron';

import { mapErrorTo } from '../../../../../utils/errors';
import { filesystemItemTypes } from '../../constants/filesystem-item-types';
import {
  AbortError,
  AccessControlError,
  DataIntegrityError,
  NotFoundError,
  RepositoryError,
} from '../../errors';
import { type Filesystem } from '../../ports/filesystem';
import {
  type Directory,
  type File,
  isBinaryFile,
  isTextFile,
} from '../../types';
import { isHidden, isNodeError, pathContainsHiddenEntries } from './utils';

const showDirPicker = (): Effect.Effect<
  Electron.OpenDialogReturnValue,
  AbortError,
  never
> =>
  pipe(
    Effect.promise(() =>
      dialog.showOpenDialog({
        properties: ['openDirectory', 'createDirectory'],
      })
    ),
    Effect.tap((result) =>
      result.canceled
        ? Effect.fail(new AbortError('Open directory process cancelled'))
        : Effect.succeed(undefined)
    )
  );

const showFilePicker = ({
  extensions,
}: {
  extensions: string[];
}): Effect.Effect<Electron.OpenDialogReturnValue, AbortError, never> =>
  pipe(
    Effect.promise(() =>
      dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [
          {
            name: 'v2 Files',
            extensions,
          },
        ],
      })
    ),
    Effect.tap((result) =>
      result.canceled
        ? Effect.fail(new AbortError('Open file process cancelled'))
        : Effect.succeed(undefined)
    )
  );

const showSaveDialog = ({
  suggestedName,
  extensions,
}: {
  suggestedName?: string;
  extensions: Array<string>;
}): Effect.Effect<Electron.SaveDialogReturnValue, AbortError, never> => {
  const getDefaultPath = ({
    name,
    exts,
  }: {
    name?: string;
    exts: Array<string>;
  }): string => {
    const baseName = name && name.trim().length > 0 ? name : 'untitled';

    const ext = exts && exts.length > 0 ? exts[0] : '';
    return ext && !baseName.endsWith(`.${ext}`)
      ? `${baseName}.${ext}`
      : baseName;
  };

  return pipe(
    Effect.promise(() =>
      dialog.showSaveDialog({
        // TODO: Replace with suggestedName or `untitled` when
        // https://github.com/electron/electron/issues/48295 is fixed
        defaultPath: getDefaultPath({ name: suggestedName, exts: extensions }),
        filters: extensions.map((ext) => ({
          name: `${ext} Files`,
          extensions: [ext],
        })),
      })
    ),
    Effect.tap((result) =>
      result.canceled
        ? Effect.fail(new AbortError('Save dialog cancelled'))
        : Effect.succeed(undefined)
    )
  );
};

export const createAdapter = (): Filesystem => {
  const openDirectory: Filesystem['openDirectory'] = () =>
    pipe(
      showDirPicker(),
      Effect.map((result) => {
        // Get directory path and name
        const directoryPath = result.filePaths[0];
        const name = path.basename(directoryPath);

        return {
          type: filesystemItemTypes.DIRECTORY,
          name,
          path: directoryPath,
          permissionState: 'granted', // TODO: Replace with constant
        };
      })
    );

  const getDirectory: Filesystem['getDirectory'] = (directoryPath) => {
    const name = path.basename(directoryPath);

    return Effect.succeed({
      type: filesystemItemTypes.DIRECTORY,
      name,
      path: directoryPath,
      permissionState: 'granted', // TODO: Replace with constant
    });
  };

  const listDirectoryFiles: Filesystem['listDirectoryFiles'] = ({
    path: directoryPath,
    includeHidden = false,
    useRelativePath,
    recursive,
  }) =>
    pipe(
      Effect.tryPromise({
        try: () =>
          fs.readdir(directoryPath, {
            withFileTypes: true,
            recursive,
          }),
        catch: mapErrorTo(RepositoryError, 'Node filesystem API error'),
      }),
      Effect.map((dirEntries) =>
        includeHidden
          ? dirEntries
          : dirEntries.filter(
              (entry) =>
                !isHidden(entry.name) &&
                // `recursive: true` will result in files inside hidden directories being returned,
                // so we need to filter those out as well
                !pathContainsHiddenEntries(entry.parentPath)
            )
      ),
      Effect.map((dirEntries) => dirEntries.filter((entry) => entry.isFile())),
      Effect.flatMap((dirFileEntries) =>
        Effect.forEach(dirFileEntries, (entry) =>
          Effect.Do.pipe(
            Effect.bind('absolutePath', () =>
              Effect.succeed(path.join(entry.parentPath, entry.name))
            ),
            Effect.bind('resultPath', ({ absolutePath }) =>
              useRelativePath
                ? getRelativePath({
                    path: absolutePath,
                    relativeTo: directoryPath,
                  })
                : Effect.succeed(absolutePath)
            ),
            Effect.flatMap(({ resultPath }) => {
              const file: File = {
                type: filesystemItemTypes.FILE,
                name: entry.name,
                path: resultPath,
              };

              return Effect.succeed(file);
            })
          )
        )
      )
    );

  const listDirectoryTree: Filesystem['listDirectoryTree'] = ({
    path: directoryPath,
    includeHidden = false,
    useRelativePathTo,
    depth,
  }) =>
    pipe(
      Effect.tryPromise({
        try: () =>
          fs.readdir(directoryPath, {
            withFileTypes: true,
          }),
        catch: mapErrorTo(RepositoryError, 'Node filesystem API error'),
      }),
      Effect.map((dirEntries) =>
        includeHidden
          ? dirEntries
          : dirEntries.filter((entry) => !isHidden(entry.name))
      ),
      Effect.map((dirEntries) =>
        dirEntries.sort((a, b) => {
          // Sort directories first
          if (a.isDirectory() && !b.isDirectory()) {
            return -1;
          }
          if (!a.isDirectory() && b.isDirectory()) {
            return 1;
          }

          // Then sort alphabetically
          return a.name.localeCompare(b.name);
        })
      ),
      Effect.flatMap((dirEntries) =>
        Effect.forEach(dirEntries, (entry) =>
          Effect.Do.pipe(
            Effect.bind('absolutePath', () =>
              Effect.succeed(path.join(entry.parentPath, entry.name))
            ),
            Effect.bind('resultPath', ({ absolutePath }) =>
              useRelativePathTo
                ? getRelativePath({
                    path: absolutePath,
                    relativeTo: useRelativePathTo,
                  })
                : Effect.succeed(absolutePath)
            ),
            Effect.flatMap(({ absolutePath, resultPath }) => {
              if (entry.isDirectory()) {
                return pipe(
                  !depth || depth > 1
                    ? listDirectoryTree({
                        path: absolutePath,
                        useRelativePathTo,
                        depth: depth ? depth - 1 : undefined,
                      })
                    : Effect.succeed([]),
                  Effect.map((children) => {
                    const directory: Directory = {
                      type: filesystemItemTypes.DIRECTORY,
                      name: entry.name,
                      path: resultPath,
                      children: children.length > 0 ? children : undefined,
                      permissionState: 'granted', // TODO: Replace with constant
                    };

                    return directory;
                  })
                );
              }

              const file: File = {
                type: filesystemItemTypes.FILE,
                name: entry.name,
                path: resultPath,
              };

              return Effect.succeed<Directory | File>(file);
            })
          )
        )
      )
    );

  const requestPermissionForDirectory: Filesystem['requestPermissionForDirectory'] =
    (directoryPath) =>
      pipe(
        Effect.tryPromise({
          try: () =>
            fs.access(directoryPath, fs.constants.F_OK | fs.constants.R_OK),
          catch: (err: unknown) => {
            if (isNodeError(err)) {
              switch (err.code) {
                case 'ENOENT':
                  return new NotFoundError(
                    `Directory ${directoryPath} does not exist`
                  );
                case 'EACCES':
                  return new AccessControlError(
                    `Permission denied for directory ${directoryPath}`
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
        Effect.flatMap(() => Effect.succeed('granted'))
      );

  const assertWritePermissionForDirectory: Filesystem['assertWritePermissionForDirectory'] =
    (directoryPath) =>
      pipe(
        Effect.tryPromise({
          try: () =>
            fs.access(
              directoryPath,
              fs.constants.F_OK | fs.constants.R_OK | fs.constants.W_OK
            ),
          catch: (err: unknown) => {
            if (isNodeError(err)) {
              switch (err.code) {
                case 'ENOENT':
                  return new NotFoundError(
                    `Directory ${directoryPath} does not exist`
                  );
                case 'EACCES':
                  return new AccessControlError(
                    `Permission denied for directory ${directoryPath}`
                  );
                default:
                  return new RepositoryError(err.message);
              }
            }

            return new RepositoryError(
              `Unknown when trying to access directory ${directoryPath}`
            );
          },
        })
      );

  const createNewFile: Filesystem['createNewFile'] = ({
    suggestedName,
    extensions,
    content = '',
  }) =>
    pipe(
      showSaveDialog({ suggestedName, extensions }),
      Effect.tap(({ filePath }) =>
        Effect.tryPromise({
          // Node ignores the encoding if the data is binary
          try: () => fs.writeFile(filePath, content, 'utf8'),
          catch: mapErrorTo(RepositoryError, 'Node filesystem API error'),
        })
      ),
      Effect.map(({ filePath }) => ({
        type: filesystemItemTypes.FILE,
        path: filePath,
        name: path.basename(filePath),
        content,
      }))
    );

  const openFile: Filesystem['openFile'] = ({ extensions }) =>
    pipe(
      showFilePicker({ extensions }),
      Effect.map((result) => {
        const filePath = result.filePaths[0];
        const name = path.basename(filePath);

        return {
          type: filesystemItemTypes.FILE,
          name,
          path: filePath,
          // TODO: Read file content
          content: '',
        };
      })
    );

  const writeFile: Filesystem['writeFile'] = ({ path: filePath, content }) =>
    Effect.tryPromise({
      try: () => fs.writeFile(filePath, content),
      catch: mapErrorTo(RepositoryError, 'Node filesystem API error'),
    });

  const readFile: (args: {
    path: string;
    encoding?: BufferEncoding;
  }) => Effect.Effect<
    File,
    AccessControlError | NotFoundError | RepositoryError,
    never
  > = ({ path: filePath, encoding }) =>
    pipe(
      Effect.tryPromise<
        string | Buffer,
        AccessControlError | NotFoundError | RepositoryError
      >({
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
              case 'EACCES':
                return new AccessControlError(
                  `Permission denied for file with path ${filePath}`
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
            case 'EACCES':
              return new AccessControlError(
                `Permission denied for file with path ${filePath}`
              );
            default:
              return new RepositoryError(err.message);
          }
        }

        return new RepositoryError(`Error reading file with path ${filePath}`);
      },
    });

  const getRelativePath: Filesystem['getRelativePath'] = ({
    path: descendantPath,
    relativeTo,
  }) =>
    Effect.try({
      try: () => path.relative(relativeTo, descendantPath),
      catch: mapErrorTo(
        RepositoryError,
        'Could not resolve path relative to directory'
      ),
    });

  const getAbsolutePath: Filesystem['getAbsolutePath'] = ({
    path: descendantPath,
    dirPath,
  }) =>
    Effect.try({
      try: () => path.join(dirPath, descendantPath),
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
