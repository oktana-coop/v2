import { createContext, useEffect, useState } from 'react';

import { Filesystem } from '../ports/filesystem';
import type { Directory, File } from '../types';

type FilesystemContextType = {
  directory: Directory | null;
  directoryFiles: Array<File>;
  openDirectory: () => Promise<Directory | null>;
  requestPermissionForSelectedDirectory: () => Promise<void>;
  createNewFile: () => Promise<File>;
  writeFile: (path: string, content: string) => Promise<void>;
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
      const directory = await filesystem.getSelectedDirectory();
      setDirectory(directory);
    };

    getSelectedDirectory();
  }, []);

  useEffect(() => {
    const getFiles = async () => {
      const files = await filesystem.listSelectedDirectoryFiles();
      setDirectoryFiles(files);
    };

    if (directory && directory.permissionState === 'granted') {
      getFiles();
    }
  }, [directory]);

  const openDirectory = async () => {
    const directory = await filesystem.openDirectory();
    setDirectory(directory);
    return directory;
  };

  const requestPermissionForSelectedDirectory = async () => {
    const permissionState =
      await filesystem.requestPermissionForSelectedDirectory();
    if (directory) {
      setDirectory({ ...directory, permissionState });
    }
  };

  const createNewFile = filesystem.createNewFile;
  const writeFile = filesystem.writeFile;

  return (
    <FilesystemContext.Provider
      value={{
        directory,
        directoryFiles,
        openDirectory,
        requestPermissionForSelectedDirectory,
        createNewFile,
        writeFile,
      }}
    >
      {children}
    </FilesystemContext.Provider>
  );
};
