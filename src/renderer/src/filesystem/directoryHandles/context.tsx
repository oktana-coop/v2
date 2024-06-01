import { createContext, useEffect, useState } from 'react';
import { openDB, getFirst, insertOne } from './database';

type DirectoryContextType = {
  directoryHandle: FileSystemDirectoryHandle | null;
  setDirectoryHandle: (
    directoryHandle: FileSystemDirectoryHandle
  ) => Promise<void>;
};

export const DirectoryContext = createContext<DirectoryContextType>({
  directoryHandle: null,
  // This is a placeholder. It will be properly implemented in the provider below.
  setDirectoryHandle: async () => {},
});

export const DirectoryProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [directoryHandle, setDirectoryHandle] =
    useState<FileSystemDirectoryHandle | null>(null);

  useEffect(() => {
    const getFirstHandle = async () => {
      // This is the IndexedDB object store for the directory handles
      const db = await openDB();
      const directoryHandle = await getFirst(db);

      setDirectoryHandle(directoryHandle);
    };

    getFirstHandle();
  }, []);

  const persistDirectoryHandle = async (handle: FileSystemDirectoryHandle) => {
    setDirectoryHandle(handle);
    const db = await openDB();
    await insertOne({ handle, db });
  };

  return (
    <DirectoryContext.Provider
      value={{ directoryHandle, setDirectoryHandle: persistDirectoryHandle }}
    >
      {children}
    </DirectoryContext.Provider>
  );
};
