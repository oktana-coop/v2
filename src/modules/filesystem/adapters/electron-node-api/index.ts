import { promises as fs } from 'node:fs';
import path from 'node:path';

import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import { dialog } from 'electron';

import { mapErrorTo } from '../../../../utils/errors';
import { filesystemItemTypes } from '../../constants/filesystem-item-types';
import {
  AbortError,
  AccessControlError,
  DataIntegrityError,
  NotFoundError,
  RepositoryError,
} from '../../errors';
import { Filesystem } from '../../ports/filesystem';
import { File } from '../../types';
import { isHiddenFile, isNodeError } from './utils';

const showDirPicker = (): Effect.Effect<
  Electron.OpenDialogReturnValue,
  AbortError,
  never
> =>
  pipe(
    Effect.promise(() =>
      dialog.showOpenDialog({
        properties: ['openDirectory'],
      })
    ),
    Effect.tap((result) =>
      result.canceled
        ? Effect.fail(new AbortError('Open directory process cancelled'))
        : Effect.succeed(undefined)
    )
  );

const showSaveDialog = (
  suggestedName: string
): Effect.Effect<Electron.SaveDialogReturnValue, AbortError, never> =>
  pipe(
    Effect.promise(() =>
      dialog.showSaveDialog({
        defaultPath: suggestedName,
        filters: [{ name: 'v2 Files', extensions: ['v2'] }],
      })
    ),
    Effect.tap((result) =>
      result.canceled
        ? Effect.fail(new AbortError('Save dialog cancelled'))
        : Effect.succeed(undefined)
    )
  );

export const createAdapter = (): Filesystem => ({
  openDirectory: () =>
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
    ),
  getDirectory: (directoryPath: string) => {
    const name = path.basename(directoryPath);

    return Effect.succeed({
      type: filesystemItemTypes.DIRECTORY,
      name,
      path: directoryPath,
      permissionState: 'granted', // TODO: Replace with constant
    });
  },
  listDirectoryFiles: (directoryPath: string) =>
    Effect.fail(new DataIntegrityError('foo')),
  // pipe(
  //   Effect.tryPromise({
  //     try: () =>
  //       fs.readdir(directoryPath, {
  //         withFileTypes: true,
  //       }),
  //     catch: mapErrorTo(RepositoryError, 'Node filesystem API error'),
  //   }),
  //   Effect.map((dirEntries) => {
  //     const files = dirEntries
  //       .filter((entry) => entry.isFile())
  //       .map((entry) => {
  //         const file: File = {
  //           type: filesystemItemTypes.FILE,
  //           name: entry.name,
  //           path: path.join(directoryPath, entry.name),
  //         };

  //         return file;
  //       })
  //       .filter((file) => !isHiddenFile(file.path!));

  //     return files;
  //   })
  // ),
  requestPermissionForDirectory: (directoryPath: string) =>
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
    ),
  assertWritePermissionForDirectory: (directoryPath: string) =>
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
    ),
  createNewFile: (suggestedName) => {
    const initialContent = '';

    return pipe(
      showSaveDialog(suggestedName),
      Effect.tap(({ filePath }) =>
        Effect.tryPromise({
          try: () => fs.writeFile(filePath, initialContent, 'utf8'),
          catch: mapErrorTo(RepositoryError, 'Node filesystem API error'),
        })
      ),
      Effect.map(({ filePath }) => ({
        type: filesystemItemTypes.FILE,
        path: filePath,
        name: path.basename(filePath),
        content: initialContent,
      }))
    );
  },
  writeFile: (filePath: string, content: string) =>
    Effect.tryPromise({
      try: () => fs.writeFile(filePath, content, 'utf8'),
      catch: mapErrorTo(RepositoryError, 'Node filesystem API error'),
    }),
  readFile: (filePath: string) =>
    pipe(
      Effect.tryPromise({
        try: () => fs.readFile(filePath, 'utf8'),
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
    ),
});
