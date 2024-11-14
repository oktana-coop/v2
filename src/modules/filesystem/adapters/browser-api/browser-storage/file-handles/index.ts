import {
  clearAll,
  clearAndInsertMany,
  get,
  insertOne,
  openDB,
} from './database';
import { IDBFileInfo } from './types';

export const persistFileHandle = async ({
  handle,
  relativePath,
}: {
  handle: FileSystemFileHandle;
  relativePath: string;
}) => {
  const db = await openDB();
  const fileInfo: IDBFileInfo = { fileHandle: handle, relativePath };
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

export const setSelectedFile = async (relativePath: string) => {
  // For the selected file we can use the simplicity of local storage
  // (we only store the relative path in this case and we can get the handle from IndexedDB if needed)
  localStorage.setItem('selectedFile', relativePath);
};

export const clearFileSelection = async () => {
  localStorage.removeItem('selectedFile');
};

export const getSelectedFile = async () => {
  const selectedFileRelativePath = localStorage.getItem('selectedFile');

  if (!selectedFileRelativePath) {
    return null;
  }

  const fileInfo = await getFileHandle(selectedFileRelativePath);

  if (!fileInfo) {
    return null;
  }

  return {
    path: selectedFileRelativePath,
    fileInfo,
  };
};
