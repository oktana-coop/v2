const dbName = 'file_handles';
const dbVersion = 1;
const storeName = 'file_handles';

import { FileInfo } from './types';

export const openDB: () => Promise<IDBDatabase> = () => {
  const request = window.indexedDB.open(dbName, dbVersion);

  return new Promise((resolve, reject) => {
    request.onerror = (err) => {
      return reject(err);
    };

    // In this case the database already exists and we get the reference to it.
    request.onsuccess = () => {
      resolve(request.result);
    };

    // Handle initial DB creation and migrations here.
    // Then, return the reference to the DB.
    request.onupgradeneeded = () => {
      const db = request.result;
      const objectStore = db.createObjectStore(storeName);

      objectStore.transaction.oncomplete = () => {
        return resolve(db);
      };

      objectStore.transaction.onerror = (err) => {
        return reject(err);
      };

      objectStore.transaction.onabort = () => {
        return reject(new Error('Object store transaction aborted'));
      };
    };
  });
};

// Clears the database and inserts a single file info object.
export const clearAndInsertOne: (input: {
  fileInfo: FileInfo;
  db: IDBDatabase;
}) => Promise<void> = ({ fileInfo, db }) => {
  const transaction = db.transaction(storeName, 'readwrite');

  const store = transaction.objectStore(storeName);
  store.clear();
  store.add(fileInfo, fileInfo.automergeUrl);

  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = (err) => reject(err);
  });
};

export const clearAll: (db: IDBDatabase) => Promise<void> = (db) => {
  const request = db
    .transaction(storeName, 'readwrite')
    .objectStore(storeName)
    .clear();

  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve();
    request.onerror = (err) => reject(err);
  });
};

export const get: (input: {
  db: IDBDatabase;
  automergeUrl: FileInfo['automergeUrl'];
}) => Promise<FileInfo | null> = ({ automergeUrl, db }) => {
  const request = db
    .transaction(storeName, 'readwrite')
    .objectStore(storeName)
    .get(automergeUrl);

  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      resolve((request.result as FileInfo) ?? null);
    };

    request.onerror = (err) => reject(err);
  });
};
