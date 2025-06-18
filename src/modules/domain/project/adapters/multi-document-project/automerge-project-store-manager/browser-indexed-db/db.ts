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
