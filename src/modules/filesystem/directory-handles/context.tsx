import { createContext, useEffect, useState } from 'react';

import { Filesystem } from '../ports/filesystem';
import type { Directory, File } from '../types';

type DirectoryContextType = {
  directory: Directory | null;
  openDirectory: () => Promise<Directory | null>;
  listSelectedDirectoryFiles: () => Promise<Array<File>>;
};

export const DirectoryContext = createContext<DirectoryContextType>({
  directory: null,
  openDirectory: async () => null,
  listSelectedDirectoryFiles: async () => [],
});

export const DirectoryProvider = ({
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

  const listSelectedDirectoryFiles = async () => {
    const files = await filesystem.listSelectedDirectoryFiles();
    return files;
  };

  return (
    <DirectoryContext.Provider
      value={{
        directory,
        openDirectory,
        listSelectedDirectoryFiles,
      }}
    >
      {children}
    </DirectoryContext.Provider>
  );
};
