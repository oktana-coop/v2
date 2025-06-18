import { type Repo } from '@automerge/automerge-repo/slim';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import { type VersionedDocumentStore } from '../../../../../../../modules/domain/rich-text';
import { createAdapter as createAutomergeDocumentStoreAdapter } from '../../../../../../../modules/domain/rich-text/adapters/automerge-versioned-document-store';
import { setupForWeb as setupBrowserRepoForWeb } from '../../../../../../../modules/infrastructure/version-control/automerge-repo/browser';
import { mapErrorTo } from '../../../../../../../utils/errors';
import {
  createProjectFromFilesystemContent,
  updateProjectFromFilesystemContent,
} from '../../../../commands';
import { RepositoryError as VersionedProjectRepositoryError } from '../../../../errors';
import {
  type MultiDocumentProjectStore,
  type MultiDocumentProjectStoreManager,
} from '../../../../ports';
import { createAdapter as createAutomergeProjectStoreAdapter } from '../../automerge-project-store';
import { deleteDB } from './db';

export type ElectronDeps = {
  processId: string;
};

const DB_NAME = 'multi-document-project-automerge';
const STORE_NAME = 'documents';

const setupAutomergeRepo = ({
  dbName,
  store,
}: {
  dbName: string;
  store: string;
}): Effect.Effect<Repo, VersionedProjectRepositoryError, never> =>
  Effect.tryPromise({
    try: () => setupBrowserRepoForWeb({ dbName, store }),
    catch: mapErrorTo(
      VersionedProjectRepositoryError,
      'Error in setting up Automerge repo'
    ),
  });

const setupAutomergeRepoAndStores = ({
  dbName,
  storeName,
}: {
  dbName: string;
  storeName: string;
}): Effect.Effect<
  {
    versionedProjectStore: MultiDocumentProjectStore;
    versionedDocumentStore: VersionedDocumentStore;
  },
  VersionedProjectRepositoryError,
  never
> =>
  pipe(
    Effect.tryPromise({
      try: () => deleteDB(dbName),
      catch: mapErrorTo(
        VersionedProjectRepositoryError,
        'Could not open temp IndexedDB'
      ),
    }),
    Effect.flatMap(() =>
      setupAutomergeRepo({
        dbName: dbName,
        store: storeName,
      })
    ),
    Effect.map((automergeRepo) => ({
      versionedProjectStore: createAutomergeProjectStoreAdapter(automergeRepo),
      versionedDocumentStore:
        createAutomergeDocumentStoreAdapter(automergeRepo),
    }))
  );

export const createAdapter = (): MultiDocumentProjectStoreManager => {
  const openOrCreateMultiDocumentProject: MultiDocumentProjectStoreManager['openOrCreateMultiDocumentProject'] =

      ({ openDirectory, listDirectoryFiles, readFile }) =>
      () =>
        pipe(
          openDirectory(),
          Effect.flatMap((directory) =>
            pipe(
              setupAutomergeRepoAndStores({
                dbName: DB_NAME,
                storeName: STORE_NAME,
              }),
              Effect.flatMap(
                ({ versionedProjectStore, versionedDocumentStore }) =>
                  pipe(
                    createProjectFromFilesystemContent({
                      createDocument: versionedDocumentStore.createDocument,
                      createProject: versionedProjectStore.createProject,
                      addDocumentToProject:
                        versionedProjectStore.addDocumentToProject,
                      listDirectoryFiles,
                      readFile,
                    })({ directoryPath: directory.path! }),
                    Effect.map((projectId) => ({
                      versionedProjectStore,
                      versionedDocumentStore,
                      projectId,
                      directory,
                    }))
                  )
              )
            )
          )
        );

  const openMultiDocumentProjectById: MultiDocumentProjectStoreManager['openMultiDocumentProjectById'] =

      ({ listDirectoryFiles, readFile, getDirectory }) =>
      ({ projectId, directoryPath }) =>
        pipe(
          getDirectory(directoryPath),
          Effect.flatMap((directory) =>
            pipe(
              setupAutomergeRepoAndStores({
                dbName: DB_NAME,
                storeName: STORE_NAME,
              }),
              Effect.flatMap(
                ({ versionedProjectStore, versionedDocumentStore }) =>
                  pipe(
                    updateProjectFromFilesystemContent({
                      findDocumentById: versionedDocumentStore.findDocumentById,
                      getDocumentFromHandle:
                        versionedDocumentStore.getDocumentFromHandle,
                      createDocument: versionedDocumentStore.createDocument,
                      deleteDocument: versionedDocumentStore.deleteDocument,
                      updateDocumentSpans:
                        versionedDocumentStore.updateDocumentSpans,
                      listProjectDocuments:
                        versionedProjectStore.listProjectDocuments,
                      findDocumentInProject:
                        versionedProjectStore.findDocumentInProject,
                      deleteDocumentFromProject:
                        versionedProjectStore.deleteDocumentFromProject,
                      addDocumentToProject:
                        versionedProjectStore.addDocumentToProject,
                      listDirectoryFiles,
                      readFile,
                    })({ projectId, directoryPath }),
                    Effect.map(() => ({
                      versionedProjectStore,
                      versionedDocumentStore,
                      projectId,
                      directory,
                    }))
                  )
              )
            )
          )
        );

  return {
    openOrCreateMultiDocumentProject,
    openMultiDocumentProjectById,
  };
};
