export const openDB = ({
  dbName,
  storeName,
}: {
  dbName: string;
  storeName: string;
}): Promise<IDBDatabase> => {
  const request = window.indexedDB.open(dbName, 1);

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

const getAll = ({
  db,
  storeName,
}: {
  db: IDBDatabase;
  storeName: string;
}): Promise<Array<{ key: IDBValidKey; value: unknown }>> => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.openCursor();

    const results: Array<{ key: IDBValidKey; value: unknown }> = [];

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        results.push({ key: cursor.key, value: cursor.value });
        cursor.continue();
      } else {
        resolve(results);
      }
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
};

export const insertMany = ({
  db,
  storeName,
  data,
}: {
  db: IDBDatabase;
  storeName: string;
  data: Array<{ key: IDBValidKey; value: unknown }>;
}): Promise<void> => {
  const transaction = db.transaction(storeName, 'readwrite');
  const store = transaction.objectStore(storeName);

  data.forEach(({ key, value }) => store.put(value, key));

  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = (err) => reject(err);
  });
};

export const clone: (input: {
  sourceDB: IDBDatabase;
  targetDB: IDBDatabase;
  storeName: string;
}) => Promise<void> = async ({ sourceDB, targetDB, storeName }) => {
  const sourceData = await getAll({ db: sourceDB, storeName });
  await insertMany({ db: targetDB, storeName, data: sourceData });
};

export const deleteDB = (dbName: string): Promise<void> => {
  const request = window.indexedDB.deleteDatabase(dbName);

  return new Promise((resolve, reject) => {
    request.onerror = (err) => {
      return reject(err);
    };

    // In this case the database already exists and we get the reference to it.
    request.onsuccess = () => {
      return resolve();
    };

    request.onblocked = () => {
      console.warn(
        `Deletion of IndexedDB "${dbName}" is blocked by open connections.`
      );
      return resolve();
    };
  });
};
