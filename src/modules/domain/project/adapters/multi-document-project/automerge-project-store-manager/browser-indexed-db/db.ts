export const openDB = ({
  dbName,
  documentStoreName: documentStoreName,
  metadataStoreName: metadataStoreName,
}: {
  dbName: string;
  documentStoreName: string;
  metadataStoreName: string;
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
    request.onupgradeneeded = (event) => {
      const db = request.result;
      db.createObjectStore(documentStoreName);
      db.createObjectStore(metadataStoreName);

      const target = event.target as IDBOpenDBRequest | null;
      if (!target || !target.transaction) {
        reject(new Error('Failed to get transaction from event target'));
        return;
      }
      const transaction = target.transaction as IDBTransaction;

      transaction.oncomplete = () => resolve(db);
      transaction.onerror = (err) => reject(err);
      transaction.onabort = () =>
        reject(new Error('Object store transaction aborted'));
    };
  });
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
  });
};

export const insertMany = ({
  db,
  storeName,
  data,
}: {
  db: IDBDatabase;
  storeName: string;
  data: Array<{ key: IDBValidKey; value: string }>;
}): Promise<void> => {
  const transaction = db.transaction(storeName, 'readwrite');
  const store = transaction.objectStore(storeName);

  data.forEach(({ key, value }) => store.put(value, key));

  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = (err) => reject(err);
  });
};

export const insertOne: (input: {
  db: IDBDatabase;
  storeName: string;
  key: IDBValidKey;
  value: string;
}) => Promise<void> = ({ db, storeName, key, value }) => {
  const transaction = db
    .transaction(storeName, 'readwrite')
    .objectStore(storeName)
    .add(key, value);

  return new Promise((resolve, reject) => {
    transaction.onsuccess = () => resolve();
    transaction.onerror = (err) => reject(err);
  });
};

export const get: (input: {
  db: IDBDatabase;
  storeName: string;
  key: IDBValidKey;
}) => Promise<string | null> = ({ db, storeName, key }) => {
  const request = db
    .transaction(storeName, 'readwrite')
    .objectStore(storeName)
    .get(key);

  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      resolve((request.result as string) ?? null);
    };

    request.onerror = (err) => reject(err);
  });
};
