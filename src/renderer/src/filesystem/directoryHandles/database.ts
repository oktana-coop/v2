const dbName = 'directory_handles';
const dbVersion = 1;
const storeName = 'directory_handles';

export const openDB: () => Promise<IDBObjectStore> = () => {
  const request = window.indexedDB.open(dbName, dbVersion);

  return new Promise((resolve, reject) => {
    request.onerror = (err) => {
      return reject(err);
    };

    // In this case the database already exists and we get the reference to the object store.
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction([storeName], 'readwrite');

      transaction.oncomplete = () => {
        resolve(transaction.objectStore(storeName));
      };

      transaction.onerror = (err) => {
        return reject(err);
      };

      transaction.onabort = () => {
        return reject(new Error('Object store transaction aborted'));
      };
    };

    // Handle initial DB creation and migrations here.
    // Then, return the reference to the newly created object store.
    request.onupgradeneeded = () => {
      const db = request.result;
      const objectStore = db.createObjectStore(storeName, { keyPath: 'name' });

      objectStore.transaction.oncomplete = () => {
        return resolve(objectStore);
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

export const insertOne: (input: {
  handle: FileSystemDirectoryHandle;
  objectStore: IDBObjectStore;
}) => Promise<void> = ({ handle, objectStore }) => {
  const request = objectStore.add(handle);

  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve();
    request.onerror = (err) => reject(err);
  });
};

export const getFirst: (
  objectStore: IDBObjectStore
) => Promise<FileSystemDirectoryHandle | null> = (objectStore) => {
  const request = objectStore.openCursor();

  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      resolve((request.result?.value as FileSystemDirectoryHandle) ?? null);
    };

    request.onerror = (err) => reject(err);
  });
};
