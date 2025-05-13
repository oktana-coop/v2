import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import { fromNullable } from '../../../../../utils/effect';
import { mapErrorTo } from '../../../../../utils/errors';
import { FILE_EXTENSION } from '../../../constants';
import { filesystemItemTypes } from '../../../constants/filesystem-item-types';
import {
  AbortError,
  AccessControlError,
  NotFoundError,
  RepositoryError,
} from '../../../errors';
import { Filesystem } from '../../../ports/filesystem';
import { File } from '../../../types';
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

const getFileRelativePath = async (
  fileHandle: FileSystemFileHandle,
  relativeTo: FileSystemDirectoryHandle
) => {
  const relativePathSegments = await relativeTo.resolve(fileHandle);

  if (!relativePathSegments) {
    throw new Error(
      `Could not resolve relative path for file ${fileHandle.name}`
    );
  }

  return [relativeTo.name, ...relativePathSegments].join('/');
};

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
  fileHandle: FileSystemFileHandle
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
  listDirectoryFiles: async (path: string) => {
    const directoryHandle = await getDirectoryHandle(path);

    if (!directoryHandle) {
      // TODO: Handle better with typed errors
      throw new Error(
        'The directory handle was not found in the browser storage'
      );
    }

    type FileWithHandle = File & {
      handle: FileSystemFileHandle;
    };

    const files: Array<FileWithHandle> = [];

    for await (const [key, value] of directoryHandle.entries()) {
      if (value.kind === 'file' && value.name.endsWith(FILE_EXTENSION)) {
        const relativePath = await getFileRelativePath(value, directoryHandle);

        const file: FileWithHandle = {
          type: filesystemItemTypes.FILE,
          name: key,
          path: relativePath,
          handle: value,
        };

        files.push(file);
      }
    }

    await clearAllAndInsertManyFileHandles(
      files.map((file) => ({
        fileHandle: file.handle,
        relativePath: file.path!,
      }))
    );

    return files;
  },
  requestPermissionForDirectory: (path: string) =>
    pipe(
      getDirHandleFromStorage(path),
      Effect.flatMap((directoryHandle) => requestPermission(directoryHandle))
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
  createNewFile: async (suggestedName) => {
    // Prompt the user to select where to save the file
    const fileHandle = await window.showSaveFilePicker({
      excludeAcceptAllOption: true,
      suggestedName,
      types: [
        {
          description: 'v2',
          accept: {
            'application/v2': [FILE_EXTENSION],
          },
        },
      ],
    });

    const writable = await fileHandle.createWritable();

    // Write initial content to the file
    const initialContent = '';
    await writable.write(initialContent);
    await writable.close();

    // In this case we aren't necessarily allowed to access the containing folder;
    // this is why the relative path is just a filename
    const path = fileHandle.name;

    // Store file handles in the browser storage so that we can retrieve them later on by relative bath.
    await persistFileHandle({
      handle: fileHandle,
      relativePath: fileHandle.name,
    });

    return {
      type: filesystemItemTypes.FILE,
      path,
      name: fileHandle.name,
      content: initialContent,
    };
  },
});
