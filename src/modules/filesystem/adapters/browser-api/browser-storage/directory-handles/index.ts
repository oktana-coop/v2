import { clearAndInsertOne, getFirst, openDB } from './database';

export const getSelectedDirectoryHandle = async () => {
  // This is the IndexedDB object store for the directory handles
  const db = await openDB();
  return getFirst(db);
};

export const persistDirectoryHandle = async (
  handle: FileSystemDirectoryHandle
) => {
  const db = await openDB();
  await clearAndInsertOne({ handle, db });
};
