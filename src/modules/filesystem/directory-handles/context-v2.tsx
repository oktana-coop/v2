import { createContext, useEffect, useState } from 'react';

import { Filesystem } from '../ports/filesystem';
import type { Directory } from '../types';

type DirectoryContextType = {
  directory: Directory | null;
  openDirectory: () => Promise<Directory | null>;
};

export const DirectoryContext = createContext<DirectoryContextType>({
  directory: null,
  openDirectory: async () => null,
});

export const DirectoryProvider = ({
  filesystem,
  children,
}: {
  filesystem: Filesystem;
  children: React.ReactNode;
}) => {
  const [directory, setDirectory] = useState<Directory | null>(null);

  const openDirectory = async () => {
    const directory = await filesystem.openDirectory();
    setDirectory(directory);
    return directory;
  };

  useEffect(() => {
    const getSelectedDirectory = async () => {
      const directory = await filesystem.getSelectedDirectory();
      setDirectory(directory);
    };

    getSelectedDirectory();
  }, []);

  return (
    <DirectoryContext.Provider
      value={{
        directory,
        openDirectory,
      }}
    >
      {children}
    </DirectoryContext.Provider>
  );
};
