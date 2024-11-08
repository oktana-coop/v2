import { createContext, useEffect, useState } from 'react';

import { Filesystem } from '../ports/filesystem';
import type { Directory, File } from '../types';

type FilesystemContextType = {
  directory: Directory | null;
  openDirectory: () => Promise<Directory | null>;
  listSelectedDirectoryFiles: () => Promise<Array<File>>;
  requestPermissionForSelectedDirectory: () => Promise<void>;
  createNewFile: () => Promise<File>;
  writeFile: (path: string, content: string) => Promise<void>;
};

export const FilesystemContext = createContext<FilesystemContextType>({
  directory: null,
  openDirectory: async () => null,
  listSelectedDirectoryFiles: async () => [],
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

  useEffect(() => {
    const getSelectedDirectory = async () => {
      const directory = await filesystem.getSelectedDirectory();
      setDirectory(directory);
    };

    getSelectedDirectory();
  }, []);

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

  const listSelectedDirectoryFiles = filesystem.listSelectedDirectoryFiles;

  const createNewFile = filesystem.createNewFile;
  const writeFile = filesystem.writeFile;

  return (
    <FilesystemContext.Provider
      value={{
        directory,
        openDirectory,
        listSelectedDirectoryFiles,
        requestPermissionForSelectedDirectory,
        createNewFile,
        writeFile,
      }}
    >
      {children}
    </FilesystemContext.Provider>
  );
};
