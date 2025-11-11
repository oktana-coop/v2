import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
// Assuming `path` resolves to `path-browserify` using the build system.
import path from 'path';

import { fromNullable } from '../../../../../../utils/effect';
import { mapErrorTo } from '../../../../../../utils/errors';
import { filesystemItemTypes } from '../../../constants/filesystem-item-types';
import {
  AbortError,
  AccessControlError,
  NotFoundError,
  RepositoryError,
} from '../../../errors';
import { Filesystem } from '../../../ports/filesystem';
import {
  clearAllAndInsertManyFileHandles,
  clearFileHandles,
  getDirectoryHandle,
  getFileHandle,
  persistDirectoryHandle,
  persistFileHandle,
} from './../browser-storage';

const showDirPicker = (): Effect.Effect<
  FileSystemDirectoryHandle,
  AbortError | RepositoryError,
  never
> =>
  Effect.tryPromise({
    try: () => window.showDirectoryPicker(),
    catch: (err: unknown) => {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return new AbortError(err.message);
      }

      return mapErrorTo(RepositoryError, 'Browser filesystem API error')(err);
    },
  });

const showFilePicker = ({
  extensions,
}: {
  extensions: Array<string>;
}): Effect.Effect<FileSystemFileHandle, AbortError | RepositoryError, never> =>
  pipe(
    Effect.tryPromise({
      try: () =>
        window.showOpenFilePicker({
          excludeAcceptAllOption: true,
          types: [
            {
              description: 'v2',
              accept: {
                'application/octet-stream': extensions.map((ext) =>
                  ext.startsWith('.') ? ext : `.${ext}`
                ) as `.${string}`[],
              },
            },
          ],
        }),
      catch: (err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return new AbortError(err.message);
        }

        return mapErrorTo(RepositoryError, 'Browser filesystem API error')(err);
      },
    }),
    Effect.flatMap((fileHandles) =>
      fileHandles.length === 1
        ? Effect.succeed(fileHandles[0])
        : Effect.fail(
            new RepositoryError(
              'Error in file selection. Expected a single file returned.'
            )
          )
    )
  );
const showSaveFilePicker = ({
  suggestedName,
  extensions,
}: {
  suggestedName?: string;
  extensions: Array<string>;
}): Effect.Effect<FileSystemFileHandle, AbortError | RepositoryError, never> =>
  Effect.tryPromise({
    try: () =>
      window.showSaveFilePicker({
        excludeAcceptAllOption: true,
        suggestedName,
        types: [
          {
            description: 'v2',
            accept: {
              'application/octet-stream': extensions.map((ext) =>
                ext.startsWith('.') ? ext : `.${ext}`
              ) as `.${string}`[],
            },
          },
        ],
      }),
    catch: (err: unknown) => {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return new AbortError(err.message);
      }

      return mapErrorTo(RepositoryError, 'Browser filesystem API error')(err);
    },
  });

const getFileRelativePath = (
  fileHandle: FileSystemFileHandle,
  relativeTo: FileSystemDirectoryHandle
): Effect.Effect<string, RepositoryError, never> =>
  pipe(
    Effect.promise(() => relativeTo.resolve(fileHandle)),
    Effect.flatMap((relativePathSegments) =>
      fromNullable(
        relativePathSegments,
        () =>
          new RepositoryError(
            `Could not resolve relative path for file ${fileHandle.name}`
          )
      )
    ),
    Effect.map((relativePathSegments) =>
      [relativeTo.name, ...relativePathSegments].join('/')
    )
  );

const getPermissionState = (
  handle: FileSystemHandle
): Effect.Effect<PermissionState, never, never> =>
  Effect.promise(() => handle.queryPermission());

const requestPermission = (
  handle: FileSystemHandle
): Effect.Effect<PermissionState, RepositoryError, never> =>
  Effect.tryPromise({
    try: () => handle.requestPermission(),
    catch: mapErrorTo(RepositoryError, 'Request permission error'),
  });

const assertWritePermission = (
  fileHandle: FileSystemHandle
): Effect.Effect<void, AccessControlError | RepositoryError, never> => {
  const options: FileSystemHandlePermissionDescriptor = {};
  options.mode = 'readwrite';

  return pipe(
    getPermissionState(fileHandle),
    Effect.flatMap((existingPermission) =>
      existingPermission === 'granted'
        ? Effect.succeed(undefined)
        : requestPermission(fileHandle).pipe(
            Effect.flatMap((requestedPermission) =>
              requestedPermission === 'granted'
                ? Effect.succeed(undefined)
                : Effect.fail(new AccessControlError('Write permission denied'))
            )
          )
    )
  );
};

const getDirHandleFromStorage = (
  path: string
): Effect.Effect<
  FileSystemDirectoryHandle,
  NotFoundError | RepositoryError,
  never
> =>
  pipe(
    Effect.tryPromise({
      try: () => getDirectoryHandle(path),
      catch: mapErrorTo(RepositoryError, 'Browser storage error'),
    }),
    Effect.flatMap((directoryHandle) =>
      fromNullable(
        directoryHandle,
        () => new NotFoundError('Directory handle not found in browser storage')
      )
    )
  );

const persistFileHandleInStorage = (args: {
  handle: FileSystemFileHandle;
  relativePath: string;
}): Effect.Effect<void, RepositoryError, never> =>
  Effect.tryPromise({
    try: () => persistFileHandle(args),
    catch: mapErrorTo(RepositoryError, 'Browser storage error'),
  });

const getFileHandleFromStorage = (
  path: string
): Effect.Effect<
  FileSystemFileHandle,
  NotFoundError | RepositoryError,
  never
> =>
  pipe(
    Effect.tryPromise({
      try: () => getFileHandle(path),
      catch: mapErrorTo(RepositoryError, 'Browser storage error'),
    }),
    Effect.flatMap((fileInfo) =>
      fromNullable(
        fileInfo,
        () => new NotFoundError('File handle not found in browser storage')
      )
    ),
    Effect.map((file) => file.fileHandle)
  );

export const createAdapter = (): Filesystem => ({
  openDirectory: () =>
    Effect.Do.pipe(
      Effect.bind('dirHandle', () => showDirPicker()),
      Effect.bind('permissionState', ({ dirHandle }) =>
        getPermissionState(dirHandle)
      ),
      Effect.tap(({ dirHandle }) =>
        Effect.tryPromise({
          try: () => persistDirectoryHandle(dirHandle),
          catch: mapErrorTo(RepositoryError, 'Browser storage error'),
        })
      ),
      Effect.tap(() =>
        Effect.tryPromise({
          try: () => clearFileHandles(),
          catch: mapErrorTo(RepositoryError, 'Browser storage error'),
        })
      ),
      Effect.map(({ dirHandle, permissionState }) => ({
        type: filesystemItemTypes.DIRECTORY,
        name: dirHandle.name,
        path: dirHandle.name,
        permissionState,
      }))
    ),
  getDirectory: (path: string) =>
    Effect.Do.pipe(
      Effect.bind('dirHandle', () => getDirHandleFromStorage(path)),
      Effect.bind('permissionState', ({ dirHandle }) =>
        getPermissionState(dirHandle)
      ),
      Effect.map(({ dirHandle, permissionState }) => ({
        type: filesystemItemTypes.DIRECTORY,
        name: dirHandle.name,
        path: dirHandle.name,
        permissionState,
      }))
    ),
  listDirectoryFiles: ({ path, extensions, useRelativePath }) =>
    Effect.Do.pipe(
      Effect.bind('directoryHandle', () => getDirHandleFromStorage(path)),
      Effect.bind('entries', ({ directoryHandle }) =>
        Effect.tryPromise({
          // TODO: Replace with `Array.fromAsync` when it's more widely supported
          try: async () => {
            const entries: [string, FileSystemHandle][] = [];
            for await (const entry of directoryHandle.entries()) {
              entries.push(entry);
            }
            return entries;
          },
          catch: mapErrorTo(
            RepositoryError,
            'Failed to read directory entries'
          ),
        })
      ),
      Effect.flatMap(({ entries, directoryHandle }) => {
        const isFileEntry = (
          entry: [string, FileSystemHandle]
        ): entry is [string, FileSystemFileHandle] => {
          const [, handle] = entry;
          return handle.kind === 'file';
        };

        return Effect.forEach(
          entries.filter(
            (entry): entry is [string, FileSystemFileHandle] =>
              isFileEntry(entry) &&
              (extensions === undefined ||
                extensions.some((ext) => entry[1].name.endsWith(`.${ext}`)))
          ),
          ([key, value]) =>
            useRelativePath
              ? pipe(
                  getFileRelativePath(value, directoryHandle),
                  Effect.map((relativePath) => ({
                    type: filesystemItemTypes.FILE,
                    name: key,
                    path: relativePath,
                    handle: value,
                  }))
                )
              : Effect.succeed({
                  type: filesystemItemTypes.FILE,
                  name: key,
                  path: value.name,
                  handle: value,
                }),
          { concurrency: 10 }
        );
      }),
      Effect.tap((files) =>
        Effect.tryPromise({
          try: () =>
            clearAllAndInsertManyFileHandles(
              files.map((file) => ({
                fileHandle: file.handle,
                relativePath: file.path,
              }))
            ),
          catch: mapErrorTo(
            RepositoryError,
            'Failed to persist file handles in the browser storage'
          ),
        })
      )
    ),
  requestPermissionForDirectory: (path: string) =>
    pipe(
      getDirHandleFromStorage(path),
      Effect.flatMap((directoryHandle) => requestPermission(directoryHandle))
    ),
  assertWritePermissionForDirectory: (path: string) =>
    pipe(
      getDirHandleFromStorage(path),
      Effect.flatMap((directoryHandle) =>
        assertWritePermission(directoryHandle)
      )
    ),
  readFile: (path: string) =>
    Effect.Do.pipe(
      Effect.bind('fileHandle', () => getFileHandleFromStorage(path)),
      Effect.bind('fileData', ({ fileHandle }) =>
        Effect.tryPromise({
          try: () => fileHandle.getFile(),
          catch: (err: unknown) => {
            if (err instanceof DOMException) {
              if (err.name === 'NotAllowedError') {
                return new AccessControlError(err.message);
              } else if (err.name === 'NotFoundError') {
                return new NotFoundError(err.message);
              }
            }

            return mapErrorTo(
              RepositoryError,
              'Browser filesystem API error'
            )(err);
          },
        })
      ),
      Effect.bind('content', ({ fileData }) =>
        Effect.tryPromise({
          try: () => fileData.text(),
          catch: mapErrorTo(RepositoryError, 'Browser filesystem API error'),
        })
      ),
      Effect.map(({ fileData, content }) => ({
        type: filesystemItemTypes.FILE,
        name: fileData.name,
        path,
        content,
      }))
    ),
  writeFile: (path: string, content: string) =>
    pipe(
      getFileHandleFromStorage(path),
      Effect.tap(assertWritePermission),
      Effect.flatMap((fileHandle) =>
        Effect.tryPromise({
          try: async () => {
            const writable = await fileHandle.createWritable();
            await writable.write(content);
            await writable.close();
          },
          catch: mapErrorTo(RepositoryError, 'Browser filesystem API error'),
        })
      )
    ),
  createNewFile: ({
    suggestedName,
    extensions,
    parentDirectory,
    content = '',
  }) =>
    Effect.Do.pipe(
      Effect.bind('fileHandle', () =>
        showSaveFilePicker({ suggestedName, extensions })
      ),
      Effect.tap(({ fileHandle }) =>
        Effect.tryPromise({
          try: async () => {
            const writable = await fileHandle.createWritable();

            // Write initial content to the file
            await writable.write(content);
            await writable.close();
          },
          catch: mapErrorTo(RepositoryError, 'Browser filesystem API error'),
        })
      ),
      Effect.bind('relativePath', ({ fileHandle }) =>
        // In this case we aren't necessarily allowed to access the containing folder;
        // This is why we fallback to the file name
        parentDirectory && parentDirectory.path
          ? pipe(
              getDirHandleFromStorage(parentDirectory.path),
              Effect.flatMap((directoryHandle) =>
                getFileRelativePath(fileHandle, directoryHandle)
              )
            )
          : Effect.succeed(fileHandle.name)
      ),
      Effect.tap(({ fileHandle, relativePath }) =>
        persistFileHandleInStorage({
          handle: fileHandle,
          relativePath,
        })
      ),
      Effect.map(({ fileHandle, relativePath }) => ({
        type: filesystemItemTypes.FILE,
        path: relativePath,
        name: fileHandle.name,
        content,
      }))
    ),
  openFile: ({ extensions }) =>
    pipe(
      showFilePicker({ extensions }),
      Effect.tap((fileHandle) =>
        persistFileHandleInStorage({
          handle: fileHandle,
          relativePath: fileHandle.name,
        })
      ),
      Effect.map((fileHandle) => ({
        type: filesystemItemTypes.FILE,
        name: fileHandle.name,
        path: fileHandle.name,
        // TODO: Read content properly
        content: '',
      }))
    ),
  getRelativePath: ({ path: descendantPath, relativeTo }) =>
    Effect.try({
      try: () => path.relative(relativeTo, descendantPath),
      catch: mapErrorTo(
        RepositoryError,
        'Could not resolve path relative to directory'
      ),
    }),
  getAbsolutePath: ({ path: descendantPath, dirPath }) =>
    Effect.try({
      try: () => path.join(dirPath, descendantPath),
      catch: mapErrorTo(
        RepositoryError,
        'Could not join directory path with relative path'
      ),
    }),
});
