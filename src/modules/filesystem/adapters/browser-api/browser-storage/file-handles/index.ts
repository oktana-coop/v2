import {
  clearAll,
  clearAndInsertMany,
  get,
  insertOne,
  openDB,
} from './database';
import { BrowserStorageFileInfo } from './types';

export const persistFileHandle = async ({
  handle,
  relativePath,
}: {
  handle: FileSystemFileHandle;
  relativePath: string;
}) => {
  const db = await openDB();
  const fileInfo: BrowserStorageFileInfo = { fileHandle: handle, relativePath };
  return await insertOne({ fileInfo, db });
};

export const clearAllAndInsertManyFileHandles = async (
  files: Array<{ fileHandle: FileSystemFileHandle; relativePath: string }>
) => {
  const db = await openDB();
  await clearAndInsertMany({ db, files });
};

export const clearFileHandles = async () => {
  const db = await openDB();
  await clearAll(db);
};

export const getFileHandle = async (relativePath: string) => {
  const db = await openDB();
  return get({ relativePath, db });
};

export * from './types';
