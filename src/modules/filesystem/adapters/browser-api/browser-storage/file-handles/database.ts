const dbName = 'file_handles';
const dbVersion = 1;
const storeName = 'file_handles';

import { IDBFileInfo } from './types';

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
  fileInfo: IDBFileInfo;
  db: IDBDatabase;
}) => Promise<void> = ({ fileInfo, db }) => {
  const transaction = db.transaction(storeName, 'readwrite');

  const store = transaction.objectStore(storeName);
  store.clear();
  store.add(fileInfo, fileInfo.relativePath);

  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = (err) => reject(err);
  });
};

export const insertOne: (input: {
  fileInfo: IDBFileInfo;
  db: IDBDatabase;
}) => Promise<void> = ({ fileInfo, db }) => {
  const transaction = db.transaction(storeName, 'readwrite');

  const store = transaction.objectStore(storeName);
  store.add(fileInfo, fileInfo.relativePath);

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

export const clearAndInsertMany: (input: {
  files: Array<IDBFileInfo>;
  db: IDBDatabase;
}) => Promise<void> = ({ files, db }) => {
  const transaction = db.transaction(storeName, 'readwrite');

  const store = transaction.objectStore(storeName);
  store.clear();

  files.forEach((fileInfo) => store.add(fileInfo, fileInfo.relativePath));

  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = (err) => reject(err);
  });
};

export const get: (input: {
  db: IDBDatabase;
  relativePath: IDBFileInfo['relativePath'];
}) => Promise<IDBFileInfo | null> = ({ relativePath, db }) => {
  const request = db
    .transaction(storeName, 'readwrite')
    .objectStore(storeName)
    .get(relativePath);

  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      resolve((request.result as IDBFileInfo) ?? null);
    };

    request.onerror = (err) => reject(err);
  });
};
