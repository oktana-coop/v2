import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as Option from 'effect/Option';

import { fromNullable } from '../../../../../utils/effect';
import { mapErrorTo } from '../../../../../utils/errors';
import { FILE_EXTENSION } from '../../../constants';
import { filesystemItemTypes } from '../../../constants/filesystem-item-types';
import { AbortError, NotFoundError, RepositoryError } from '../../../errors';
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

const getDirectoryPermissionState = (
  directoryHandle: FileSystemDirectoryHandle
): Effect.Effect<PermissionState, never, never> =>
  Effect.promise(() => directoryHandle.queryPermission());

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

const verifyWritePermission = async (fileHandle: FileSystemFileHandle) => {
  const options: FileSystemHandlePermissionDescriptor = {};
  options.mode = 'readwrite';

  // Check if permission was already granted. If so, return true.
  if ((await fileHandle.queryPermission(options)) === 'granted') {
    return true;
  }

  // Request permission. If the user grants permission, return true.
  if ((await fileHandle.requestPermission(options)) === 'granted') {
    return true;
  }

  // The user didn't grant permission, so return false.
  return false;
};

export const createAdapter = (): Filesystem => ({
  openDirectory: () =>
    Effect.Do.pipe(
      Effect.bind('dirHandle', () => showDirPicker()),
      Effect.bind('permissionState', ({ dirHandle }) =>
        getDirectoryPermissionState(dirHandle)
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
      Effect.bind('dirHandle', () =>
        pipe(
          Effect.tryPromise({
            try: () => getDirectoryHandle(path),
            catch: mapErrorTo(RepositoryError, 'Browser storage error'),
          }),
          Effect.flatMap((directoryHandle) =>
            fromNullable(
              directoryHandle,
              () =>
                new NotFoundError(
                  'Directory handle not found in browser storage'
                )
            )
          )
        )
      ),
      Effect.bind('permissionState', ({ dirHandle }) =>
        getDirectoryPermissionState(dirHandle)
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
  requestPermissionForDirectory: async (path: string) => {
    const directoryHandle = await getDirectoryHandle(path);

    if (!directoryHandle) {
      // TODO: Handle better with typed errors
      throw new Error('No current directory found in the browser storage');
    }

    const permission = await directoryHandle.requestPermission();

    return permission;
  },
  readFile: async (path: string) => {
    const fileInfo = await getFileHandle(path);

    if (!fileInfo) {
      // TODO: Handle better with typed errors
      throw new Error('File not found in browser storage');
    }

    const fileData = await fileInfo.fileHandle.getFile();
    const content = await fileData.text();

    return {
      type: filesystemItemTypes.FILE,
      name: fileData.name,
      path,
      content,
    };
  },
  writeFile: async (path: string, content: string) => {
    const fileInfo = await getFileHandle(path);

    if (!fileInfo) {
      // TODO: Handle better with typed errors
      throw new Error('File not found in browser storage');
    }

    const canWrite = await verifyWritePermission(fileInfo.fileHandle);

    if (!canWrite) {
      // TODO: Handle better with typed errors
      throw new Error('Permission error when trying to write content to file');
    }

    const writable = await fileInfo.fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
  },
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
