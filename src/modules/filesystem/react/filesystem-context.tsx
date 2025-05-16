import * as Effect from 'effect/Effect';
import { createContext, useEffect, useState } from 'react';

import { Filesystem } from '../ports/filesystem';
import type { Directory, File } from '../types';

const BROWSER_STORAGE_DIRECTORY_DATA_KEY = 'project';

type BrowserStorageDirectoryData = {
  directoryName: Directory['name'];
  directoryPath: Directory['path'];
};

export type FilesystemContextType = {
  directory: Directory | null;
  directoryFiles: Array<File>;
  filesystem: Filesystem;
  openDirectory: () => Promise<Directory | null>;
  requestPermissionForSelectedDirectory: () => Promise<void>;
  createNewFile: (suggestedName: string) => Promise<File>;
  writeFile: (path: string, content: string) => Promise<void>;
  readFile: (path: string) => Promise<File>;
  listDirectoryFiles: (path: string) => Promise<Array<File>>;
};

export const FilesystemContext = createContext<FilesystemContextType>({
  directory: null,
  directoryFiles: [],
  openDirectory: async () => null,
  // @ts-expect-error will get overriden below
  requestPermissionForSelectedDirectory: async () => null,
  // @ts-expect-error will get overriden below
  createNewFile: () => null,
  // @ts-expect-error will get overriden below
  writeFile: () => {},
  // @ts-expect-error will get overriden below
  readFile: () => {},
  // @ts-expect-error will get overriden below
  listDirectoryFiles: () => {},
});

export const FilesystemProvider = ({
  filesystem,
  children,
}: {
  filesystem: Filesystem;
  children: React.ReactNode;
}) => {
  const [directory, setDirectory] = useState<Directory | null>(null);
  const [directoryFiles, setDirectoryFiles] = useState<Array<File>>([]);

  useEffect(() => {
    const getSelectedDirectory = async () => {
      // Check if we have a project ID in the browser storage
      const browserStorageBrowserDataValue = localStorage.getItem(
        BROWSER_STORAGE_DIRECTORY_DATA_KEY
      );
      const browserStorageDirectoryData = browserStorageBrowserDataValue
        ? (JSON.parse(
            browserStorageBrowserDataValue
          ) as BrowserStorageDirectoryData)
        : null;

      if (browserStorageDirectoryData?.directoryPath) {
        const directory = await Effect.runPromise(
          filesystem.getDirectory(browserStorageDirectoryData.directoryPath)
        );
        setDirectory(directory);
      }
    };

    getSelectedDirectory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const getFiles = async (dir: Directory) => {
      if (dir.path) {
        const files = await Effect.runPromise(
          filesystem.listDirectoryFiles(dir.path)
        );
        setDirectoryFiles(files);
      }
    };

    if (directory && directory.permissionState === 'granted') {
      getFiles(directory);
    }
  }, [directory, filesystem]);

  const openDirectory = async () => {
    const directory = await Effect.runPromise(filesystem.openDirectory());
    setDirectory(directory);
    return directory;
  };

  const requestPermissionForSelectedDirectory = async () => {
    if (!directory) {
      throw new Error(
        'There is no current directory to request permissions for'
      );
    }

    return requestPermissionForDirectory(directory);
  };

  const requestPermissionForDirectory = async (dir: Directory) => {
    if (!dir.path) {
      throw new Error('The directory does not have a path');
    }

    const permissionState = await Effect.runPromise(
      filesystem.requestPermissionForDirectory(dir.path)
    );

    if (directory) {
      setDirectory({ ...directory, permissionState });
    }
  };

  const handleCreateNewFile = async (suggestedName: string) => {
    const newFile = await Effect.runPromise(
      directory
        ? filesystem.createNewFile(suggestedName, directory)
        : filesystem.createNewFile(suggestedName)
    );

    // Refresh directory files if a directory is selected
    if (
      directory &&
      directory.permissionState === 'granted' &&
      directory.path
    ) {
      const files = await Effect.runPromise(
        filesystem.listDirectoryFiles(directory.path)
      );
      setDirectoryFiles(files);
    }

    return newFile;
  };

  const writeFile = (path: string, content: string) =>
    Effect.runPromise(filesystem.writeFile(path, content));
  const readFile = (path: string) =>
    Effect.runPromise(filesystem.readFile(path));
  const listDirectoryFiles = (path: string) =>
    Effect.runPromise(filesystem.listDirectoryFiles(path));

  return (
    <FilesystemContext.Provider
      value={{
        directory,
        directoryFiles,
        filesystem,
        openDirectory,
        requestPermissionForSelectedDirectory,
        createNewFile: handleCreateNewFile,
        readFile,
        writeFile,
        listDirectoryFiles,
      }}
    >
      {children}
    </FilesystemContext.Provider>
  );
};
