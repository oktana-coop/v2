import { type Repo } from '@automerge/automerge-repo/slim';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import { createAdapter as createAutomergeDocumentStoreAdapter } from '../../../../../../../modules/domain/rich-text/adapters/automerge-versioned-document-store';
import { setupForElectron as setupBrowserRepoForElectron } from '../../../../../../../modules/infrastructure/version-control/automerge-repo/browser';
import { mapErrorTo } from '../../../../../../../utils/errors';
import { RepositoryError as VersionedProjectRepositoryError } from '../../../../errors';
import { type SingleDocumentProjectStoreManager } from '../../../../ports';
import { createAdapter as createAutomergeProjectStoreAdapter } from '../../automerge-project-store';

export type ElectronDeps = {
  processId: string;
};

const DB_VERSION = 1;
const STORE_NAME = 'documents';

export const openIndexedDB: (
  dbName?: string
) => Effect.Effect<IDBDatabase, VersionedProjectRepositoryError, never> = (
  dbName = 'automerge'
) =>
  Effect.tryPromise({
    try: () => {
      const request = window.indexedDB.open(dbName, DB_VERSION);

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
          const objectStore = db.createObjectStore(STORE_NAME);

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
    },
    catch: mapErrorTo(
      VersionedProjectRepositoryError,
      'Error in opening IndexedDB'
    ),
  });

const setupAutomergeRepo = ({
  processId,
  dbName,
  store,
}: ElectronDeps & {
  dbName: string;
  store: string;
}): Effect.Effect<Repo, VersionedProjectRepositoryError, never> =>
  Effect.tryPromise({
    try: () => setupBrowserRepoForElectron({ processId, dbName, store }),
    catch: mapErrorTo(
      VersionedProjectRepositoryError,
      'Error in setting up Automerge repo'
    ),
  });

export const createAdapter = ({
  processId,
}: ElectronDeps): SingleDocumentProjectStoreManager => {
  const setupSingleDocumentProjectStore: SingleDocumentProjectStoreManager['setupSingleDocumentProjectStore'] =

      () =>
      ({ suggestedName }) =>
        pipe(
          Effect.tryPromise({
            try: () =>
              window.singleDocumentProjectAPI.createSingleDocumentProject({
                suggestedName,
              }),
            catch: mapErrorTo(
              VersionedProjectRepositoryError,
              'Error in setting up Automerge repo'
            ),
          }),
          Effect.flatMap(({ filePath, projectId, documentId }) =>
            pipe(
              // TODO: Consider a cleaner approach of wiping IndexedDB (or the previous project's DB)
              // before setting up the new one. For now, assuming that we don't want to do this so that performance
              // is better as the user switches between known projects, and IndexedDB is guaranteed to be wiped when
              // they close the app.
              setupAutomergeRepo({
                processId,
                dbName: projectId,
                store: STORE_NAME,
              }),
              Effect.map((automergeRepo) => ({
                versionedProjectStore:
                  createAutomergeProjectStoreAdapter(automergeRepo),
                versionedDocumentStore:
                  createAutomergeDocumentStoreAdapter(automergeRepo),
                projectId,
                documentId,
                filePath,
              }))
            )
          )
        );

  const openSingleDocumentProjectStore: SingleDocumentProjectStoreManager['openSingleDocumentProjectStore'] =
    ({ filePath }) =>
      pipe(
        Effect.tryPromise({
          try: () =>
            window.singleDocumentProjectAPI.openSingleDocumentProject({
              filePath,
            }),
          catch: mapErrorTo(
            VersionedProjectRepositoryError,
            'Error in setting up Automerge repo'
          ),
        }),
        Effect.flatMap(({ projectId, documentId }) =>
          pipe(
            // TODO: Consider a cleaner approach of wiping IndexedDB (or the previous project's DB)
            // before setting up the new one. For now, assuming that we don't want to do this so that performance
            // is better as the user switches between known projects, and IndexedDB is guaranteed to be wiped when
            // they close the app.
            setupAutomergeRepo({
              processId,
              dbName: projectId,
              store: STORE_NAME,
            }),
            Effect.map((automergeRepo) => ({
              versionedProjectStore:
                createAutomergeProjectStoreAdapter(automergeRepo),
              versionedDocumentStore:
                createAutomergeDocumentStoreAdapter(automergeRepo),
              projectId,
              documentId,
              filePath,
            }))
          )
        )
      );

  return {
    setupSingleDocumentProjectStore,
    openSingleDocumentProjectStore,
  };
};
