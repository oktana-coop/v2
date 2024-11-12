import { FILE_EXTENSION } from '../../constants';
import { filesystemItemTypes } from '../../constants/filesystemItemTypes';
import { Filesystem } from '../../ports/filesystem';
import { File } from '../../types';
import {
  clearFileHandles,
  clearFileSelection as clearFileSelectionInBrowserStorage,
  getFileHandle,
  getSelectedDirectoryHandle,
  getSelectedFile as getSelectedFileFromBrowserStorage,
  persistDirectoryHandle,
  persistFileHandle,
  setSelectedFile as persistFileSelection,
} from './browser-storage';

const getDirectoryPermissionState = async (
  directoryHandle: FileSystemDirectoryHandle
) => {
  return directoryHandle.queryPermission();
};

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

  return [relativeTo, ...relativePathSegments].join('/');
};

const verifyPermission = async (fileHandle: FileSystemFileHandle) => {
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

export const adapter: Filesystem = {
  openDirectory: async () => {
    const dirHandle = await window.showDirectoryPicker();
    const permissionState = await getDirectoryPermissionState(dirHandle);

    await persistDirectoryHandle(dirHandle);
    // Clear file handles in the browser storage every time we open a new directory
    await clearFileHandles();

    return {
      type: filesystemItemTypes.DIRECTORY,
      name: dirHandle.name,
      path: dirHandle.name,
      permissionState,
    };
  },
  getSelectedDirectory: async () => {
    const selectedDirectoryHandle = await getSelectedDirectoryHandle();

    if (!selectedDirectoryHandle) {
      return null;
    }

    const permissionState = await getDirectoryPermissionState(
      selectedDirectoryHandle
    );

    return {
      type: filesystemItemTypes.DIRECTORY,
      name: selectedDirectoryHandle.name,
      path: selectedDirectoryHandle.name,
      permissionState,
    };
  },
  listSelectedDirectoryFiles: async () => {
    const selectedDirectoryHandle = await getSelectedDirectoryHandle();

    if (!selectedDirectoryHandle) {
      // TODO: Handle better with typed errors
      throw new Error('No current directory found in the browser storage');
    }

    const files: Array<File> = [];

    // Clear file handles in the browser storage every time we list directory files
    await clearFileHandles();

    for await (const [key, value] of selectedDirectoryHandle.entries()) {
      if (value.kind === 'file' && value.name.endsWith(FILE_EXTENSION)) {
        const relativePath = await getFileRelativePath(
          value,
          selectedDirectoryHandle
        );
        // Store file handles in the browser storage so that we can retrieve them later on by relative bath.
        await persistFileHandle({ handle: value, relativePath });

        files.push({
          type: filesystemItemTypes.FILE,
          name: key,
          path: relativePath,
        });
      }
    }

    return files;
  },
  requestPermissionForSelectedDirectory: async () => {
    const selectedDirectoryHandle = await getSelectedDirectoryHandle();

    if (!selectedDirectoryHandle) {
      // TODO: Handle better with typed errors
      throw new Error('No current directory found in the browser storage');
    }

    const permission = await selectedDirectoryHandle.requestPermission();

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

    const canWrite = await verifyPermission(fileInfo.fileHandle);

    if (!canWrite) {
      // TODO: Handle better with typed errors
      throw new Error('Permission error when trying to write content to file');
    }

    const writable = await fileInfo.fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
  },
  setSelectedFile: async (path: string) => {
    persistFileSelection(path);
  },
  clearFileSelection: async () => {
    clearFileSelectionInBrowserStorage();
  },
  getSelectedFile: async () => {
    const result = await getSelectedFileFromBrowserStorage();

    if (!result) {
      return null;
    }

    const fileData = await result.fileInfo.fileHandle.getFile();
    const content = await fileData.text();

    return {
      type: filesystemItemTypes.FILE,
      path: result.path,
      name: fileData.name,
      content,
    };
  },
  createNewFile: async () => {
    // Prompt the user to select where to save the file
    const fileHandle = await window.showSaveFilePicker({
      excludeAcceptAllOption: true,
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
};
