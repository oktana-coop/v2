import { createContext, useEffect, useState } from 'react';
import { openDB, getFirst, insertOne } from './database';

type DirectoryContextType = {
  directoryHandle: FileSystemDirectoryHandle | null;
  directoryPermissionState: PermissionState | null;
  setDirectoryPermissionState: (
    directoryPermissionState: PermissionState
  ) => void;
  setDirectoryHandle: (
    directoryHandle: FileSystemDirectoryHandle
  ) => Promise<void>;
};

export const DirectoryContext = createContext<DirectoryContextType>({
  directoryHandle: null,
  directoryPermissionState: null,
  // This is a placeholder. It will be properly implemented in the provider below.
  setDirectoryHandle: async () => {},
  setDirectoryPermissionState: async () => {},
});

export const DirectoryProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [directoryHandle, setDirectoryHandle] =
    useState<FileSystemDirectoryHandle | null>(null);
  const [directoryPermissionState, setDirectoryPermissionState] =
    useState<PermissionState | null>(null);

  useEffect(() => {
    const getFirstHandle = async () => {
      // This is the IndexedDB object store for the directory handles
      const db = await openDB();
      const directoryHandle = await getFirst(db);
      if (directoryHandle) {
        const permissionState = await directoryHandle.queryPermission();
        setDirectoryPermissionState(permissionState);
        setDirectoryHandle(directoryHandle);
      } else {
        setDirectoryHandle(null);
      }
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
      value={{
        directoryPermissionState,
        directoryHandle,
        setDirectoryHandle: persistDirectoryHandle,
        setDirectoryPermissionState: setDirectoryPermissionState,
      }}
    >
      {children}
    </DirectoryContext.Provider>
  );
};
