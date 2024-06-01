const dbName = 'directory_handles';
const dbVersion = 1;
const storeName = 'directory_handles';

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

export const insertOne: (input: {
  handle: FileSystemDirectoryHandle;
  db: IDBDatabase;
}) => Promise<void> = ({ handle, db }) => {
  console.log(handle);
  const transaction = db
    .transaction(storeName, 'readwrite')
    .objectStore(storeName)
    .add(handle, handle.name);

  return new Promise((resolve, reject) => {
    transaction.onsuccess = () => resolve();
    transaction.onerror = (err) => reject(err);
  });
};

export const getFirst: (
  db: IDBDatabase
) => Promise<FileSystemDirectoryHandle | null> = (db) => {
  const request = db
    .transaction(storeName, 'readwrite')
    .objectStore(storeName)
    .openCursor();

  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      resolve((request.result?.value as FileSystemDirectoryHandle) ?? null);
    };

    request.onerror = (err) => reject(err);
  });
};
