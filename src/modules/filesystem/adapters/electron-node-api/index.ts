import { promises as fs } from 'node:fs';
import path from 'node:path';

import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import { dialog } from 'electron';

import { mapErrorTo } from '../../../../utils/errors';
import { filesystemItemTypes } from '../../constants/filesystem-item-types';
import { AbortError, AccessControlError, RepositoryError } from '../../errors';
import { Filesystem } from '../../ports/filesystem';
import { File } from '../../types';
import { isHiddenFile } from './utils';

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
    pipe(
      Effect.tryPromise({
        try: () =>
          fs.readdir(directoryPath, {
            withFileTypes: true,
          }),
        catch: mapErrorTo(RepositoryError, 'Node filesystem API error'),
      }),
      Effect.map((dirEntries) => {
        const files = dirEntries
          .filter((entry) => entry.isFile())
          .map((entry) => {
            const file: File = {
              type: filesystemItemTypes.FILE,
              name: entry.name,
              path: path.join(directoryPath, entry.name),
            };

            return file;
          })
          .filter((file) => !isHiddenFile(file.path!));

        return files;
      })
    ),
  requestPermissionForDirectory: (directoryPath: string) =>
    pipe(
      Effect.tryPromise({
        try: () =>
          fs.access(directoryPath, fs.constants.F_OK | fs.constants.R_OK),
        // TODO: Handle in a better way, not all errors are authorization-related.
        catch: mapErrorTo(
          AccessControlError,
          'Read permission for directory denied'
        ),
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
        // TODO: Handle in a better way, not all errors are authorization-related.
        catch: mapErrorTo(
          AccessControlError,
          'Write permission for directory denied'
        ),
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
        catch: mapErrorTo(RepositoryError, 'Node filesystem API error'),
      }),
      Effect.map((content) => ({
        type: filesystemItemTypes.FILE,
        name: path.basename(filePath),
        path: filePath,
        content,
      }))
    ),
});
