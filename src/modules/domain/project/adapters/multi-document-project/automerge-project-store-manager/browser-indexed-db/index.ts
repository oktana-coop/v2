import { type Repo } from '@automerge/automerge-repo/slim';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import {
  NotFoundError as VersionedDocumentNotFoundError,
  RepositoryError as VersionedDocumentRepositoryError,
  type VersionedDocumentStore,
} from '../../../../../../../modules/domain/rich-text';
import { createAdapter as createAutomergeDocumentStoreAdapter } from '../../../../../../../modules/domain/rich-text/adapters/automerge-versioned-document-store';
import {
  AccessControlError as FilesystemAccessControlError,
  DataIntegrityError as FilesystemDataIntegrityError,
  type Filesystem,
  NotFoundError as FilesystemNotFoundError,
  RepositoryError as FilesystemRepositoryError,
} from '../../../../../../../modules/infrastructure/filesystem';
import {
  isValidVersionControlId,
  type VersionControlId,
} from '../../../../../../../modules/infrastructure/version-control';
import { setupForWeb as setupBrowserRepoForWeb } from '../../../../../../../modules/infrastructure/version-control/automerge-repo/browser';
import { fromNullable } from '../../../../../../../utils/effect';
import { mapErrorTo } from '../../../../../../../utils/errors';
import {
  createProjectFromFilesystemContent,
  updateProjectFromFilesystemContent,
} from '../../../../commands';
import {
  DataIntegrityError as VersionedProjectDataIntegrityError,
  MissingProjectMetadataError as VersionedProjectMissingProjectMetadataError,
  NotFoundError as VersionedProjectNotFoundError,
  RepositoryError as VersionedProjectRepositoryError,
} from '../../../../errors';
import {
  type MultiDocumentProjectStore,
  type MultiDocumentProjectStoreManager,
} from '../../../../ports';
import { createAdapter as createAutomergeProjectStoreAdapter } from '../../automerge-project-store';
import { get, insertMany, openDB } from './db';

export type ElectronDeps = {
  processId: string;
};

const AUTOMERGE_DOCUMENTS_STORE_NAME = 'documents';
const PROJECT_METADATA_STORE_NAME = 'project-metadata';
const PROJECT_ID_METADATA_KEY = 'projectId';

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
  projectId,
}: {
  dbName: string;
  storeName: string;
  projectId?: VersionControlId;
}): Effect.Effect<
  {
    versionedProjectStore: MultiDocumentProjectStore;
    versionedDocumentStore: VersionedDocumentStore;
  },
  VersionedProjectRepositoryError,
  never
> =>
  pipe(
    setupAutomergeRepo({
      dbName,
      store: storeName,
    }),
    Effect.map((automergeRepo) => ({
      versionedProjectStore: createAutomergeProjectStoreAdapter(automergeRepo),
      versionedDocumentStore: createAutomergeDocumentStoreAdapter(
        automergeRepo,
        projectId
      ),
    }))
  );

const openIDB = ({
  dbName,
  documentStoreName,
  metadataStoreName,
}: {
  dbName: string;
  documentStoreName: string;
  metadataStoreName: string;
}): Effect.Effect<IDBDatabase, VersionedProjectRepositoryError, never> =>
  Effect.tryPromise({
    try: () => openDB({ dbName, documentStoreName, metadataStoreName }),
    catch: mapErrorTo(
      VersionedProjectRepositoryError,
      'Could not open IndexedDB'
    ),
  });

const writeProjectMetadataToIDB = ({
  db,
  storeName,
  projectId,
}: {
  db: IDBDatabase;
  storeName: string;
  projectId: VersionControlId;
}): Effect.Effect<void, VersionedProjectRepositoryError, never> =>
  Effect.tryPromise({
    try: () =>
      insertMany({
        db,
        storeName,
        data: [
          { key: PROJECT_ID_METADATA_KEY, value: projectId },
          { key: 'createdAt', value: new Date().toISOString() },
        ],
      }),
    catch: mapErrorTo(
      VersionedProjectRepositoryError,
      'Could not open IndexedDB'
    ),
  });

const getProjectMetadataFromIDB = ({
  db,
  storeName,
}: {
  db: IDBDatabase;
  storeName: string;
}): Effect.Effect<
  VersionControlId,
  | VersionedProjectRepositoryError
  | VersionedProjectMissingProjectMetadataError
  | VersionedProjectDataIntegrityError,
  never
> =>
  pipe(
    Effect.tryPromise({
      try: () =>
        get({
          db,
          storeName,
          key: PROJECT_ID_METADATA_KEY,
        }),
      catch: mapErrorTo(
        VersionedProjectRepositoryError,
        'Could not open IndexedDB'
      ),
    }),
    Effect.flatMap((projId) =>
      fromNullable(
        projId,
        () =>
          new VersionedProjectMissingProjectMetadataError(
            'Project ID not found in IndexedDB'
          )
      )
    ),
    Effect.flatMap((projId) =>
      isValidVersionControlId(projId)
        ? Effect.succeed(projId)
        : Effect.fail(
            new VersionedProjectDataIntegrityError(
              'Malformed project ID found in IndexedDB'
            )
          )
    )
  );

const createNewProject = ({
  directoryPath,
  createDocument,
  createProject,
  addDocumentToProject,
  listDirectoryFiles,
  readFile,
  db,
}: {
  directoryPath: string;
  createDocument: VersionedDocumentStore['createDocument'];
  createProject: MultiDocumentProjectStore['createProject'];
  addDocumentToProject: MultiDocumentProjectStore['addDocumentToProject'];
  listDirectoryFiles: Filesystem['listDirectoryFiles'];
  readFile: Filesystem['readFile'];
  db: IDBDatabase;
}): Effect.Effect<
  VersionControlId,
  | FilesystemAccessControlError
  | FilesystemDataIntegrityError
  | FilesystemNotFoundError
  | FilesystemRepositoryError
  | VersionedProjectRepositoryError
  | VersionedProjectNotFoundError
  | VersionedDocumentRepositoryError,
  never
> =>
  pipe(
    createProjectFromFilesystemContent({
      createDocument,
      createProject,
      addDocumentToProject,
      listDirectoryFiles,
      readFile,
    })({ directoryPath }),
    Effect.tap((projectId) =>
      writeProjectMetadataToIDB({
        db,
        storeName: PROJECT_METADATA_STORE_NAME,
        projectId,
      })
    )
  );

const openExistingProject = ({
  directoryPath,
  findDocumentById,
  getDocumentFromHandle,
  createDocument,
  deleteDocument,
  updateDocumentSpans,
  listProjectDocuments,
  findDocumentInProject,
  deleteDocumentFromProject,
  addDocumentToProject,
  listDirectoryFiles,
  readFile,
  db,
}: {
  directoryPath: string;
  findDocumentById: VersionedDocumentStore['findDocumentById'];
  getDocumentFromHandle: VersionedDocumentStore['getDocumentFromHandle'];
  createDocument: VersionedDocumentStore['createDocument'];
  deleteDocument: VersionedDocumentStore['deleteDocument'];
  updateDocumentSpans: VersionedDocumentStore['updateDocumentSpans'];
  listProjectDocuments: MultiDocumentProjectStore['listProjectDocuments'];
  findDocumentInProject: MultiDocumentProjectStore['findDocumentInProject'];
  deleteDocumentFromProject: MultiDocumentProjectStore['deleteDocumentFromProject'];
  addDocumentToProject: MultiDocumentProjectStore['addDocumentToProject'];
  listDirectoryFiles: Filesystem['listDirectoryFiles'];
  readFile: Filesystem['readFile'];
  db: IDBDatabase;
}): Effect.Effect<
  VersionControlId,
  | FilesystemAccessControlError
  | FilesystemDataIntegrityError
  | FilesystemNotFoundError
  | FilesystemRepositoryError
  | VersionedProjectMissingProjectMetadataError
  | VersionedProjectRepositoryError
  | VersionedProjectNotFoundError
  | VersionedProjectDataIntegrityError
  | VersionedDocumentRepositoryError
  | VersionedDocumentNotFoundError,
  never
> =>
  pipe(
    getProjectMetadataFromIDB({
      db,
      storeName: PROJECT_METADATA_STORE_NAME,
    }),
    Effect.tap((projectId) =>
      updateProjectFromFilesystemContent({
        findDocumentById,
        getDocumentFromHandle,
        createDocument,
        deleteDocument,
        updateDocumentSpans,
        listProjectDocuments,
        findDocumentInProject,
        deleteDocumentFromProject,
        addDocumentToProject,
        listDirectoryFiles,
        readFile,
      })({ projectId, directoryPath })
    )
  );

const validateIdAndOpenProject = ({
  projectId,
  directoryPath,
  findDocumentById,
  getDocumentFromHandle,
  createDocument,
  deleteDocument,
  updateDocumentSpans,
  listProjectDocuments,
  findDocumentInProject,
  deleteDocumentFromProject,
  addDocumentToProject,
  listDirectoryFiles,
  readFile,
  db,
}: {
  projectId: VersionControlId;
  directoryPath: string;
  findDocumentById: VersionedDocumentStore['findDocumentById'];
  getDocumentFromHandle: VersionedDocumentStore['getDocumentFromHandle'];
  createDocument: VersionedDocumentStore['createDocument'];
  deleteDocument: VersionedDocumentStore['deleteDocument'];
  updateDocumentSpans: VersionedDocumentStore['updateDocumentSpans'];
  listProjectDocuments: MultiDocumentProjectStore['listProjectDocuments'];
  findDocumentInProject: MultiDocumentProjectStore['findDocumentInProject'];
  deleteDocumentFromProject: MultiDocumentProjectStore['deleteDocumentFromProject'];
  addDocumentToProject: MultiDocumentProjectStore['addDocumentToProject'];
  listDirectoryFiles: Filesystem['listDirectoryFiles'];
  readFile: Filesystem['readFile'];
  db: IDBDatabase;
}): Effect.Effect<
  VersionControlId,
  | FilesystemAccessControlError
  | FilesystemDataIntegrityError
  | FilesystemNotFoundError
  | FilesystemRepositoryError
  | VersionedProjectMissingProjectMetadataError
  | VersionedProjectRepositoryError
  | VersionedProjectNotFoundError
  | VersionedProjectDataIntegrityError
  | VersionedDocumentRepositoryError
  | VersionedDocumentNotFoundError,
  never
> =>
  pipe(
    getProjectMetadataFromIDB({
      db,
      storeName: PROJECT_METADATA_STORE_NAME,
    }),
    Effect.tap((projId) =>
      projId === projectId
        ? Effect.succeed(projId)
        : Effect.fail(
            new VersionedProjectDataIntegrityError(
              `Project with ID ${projectId} not found in IndexedDB`
            )
          )
    ),
    Effect.tap((projectId) =>
      updateProjectFromFilesystemContent({
        findDocumentById,
        getDocumentFromHandle,
        createDocument,
        deleteDocument,
        updateDocumentSpans,
        listProjectDocuments,
        findDocumentInProject,
        deleteDocumentFromProject,
        addDocumentToProject,
        listDirectoryFiles,
        readFile,
      })({ projectId, directoryPath })
    )
  );

export const createAdapter = (): MultiDocumentProjectStoreManager => {
  const openOrCreateMultiDocumentProject: MultiDocumentProjectStoreManager['openOrCreateMultiDocumentProject'] =

      ({ openDirectory, listDirectoryFiles, readFile }) =>
      () =>
        Effect.Do.pipe(
          Effect.bind('directory', () => openDirectory()),
          Effect.bind('db', ({ directory }) =>
            openIDB({
              dbName: directory.path,
              documentStoreName: AUTOMERGE_DOCUMENTS_STORE_NAME,
              metadataStoreName: PROJECT_METADATA_STORE_NAME,
            })
          ),
          Effect.bind('storeData', ({ directory }) =>
            setupAutomergeRepoAndStores({
              dbName: directory.path,
              storeName: AUTOMERGE_DOCUMENTS_STORE_NAME,
            })
          ),
          Effect.bind(
            'projectId',
            ({
              storeData: { versionedDocumentStore, versionedProjectStore },
              directory,
              db,
            }) =>
              pipe(
                openExistingProject({
                  directoryPath: directory.path,
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
                  db,
                }),
                Effect.catchIf(
                  (error) =>
                    error instanceof
                      VersionedProjectMissingProjectMetadataError ||
                    error instanceof VersionedProjectDataIntegrityError,
                  // Directory does not exist or can't be accessed.
                  // Create a new repo & project
                  () =>
                    createNewProject({
                      directoryPath: directory.path,
                      createDocument: versionedDocumentStore.createDocument,
                      createProject: versionedProjectStore.createProject,
                      addDocumentToProject:
                        versionedProjectStore.addDocumentToProject,
                      listDirectoryFiles,
                      readFile,
                      db,
                    })
                )
              )
          ),
          Effect.map(
            ({
              storeData: { versionedDocumentStore, versionedProjectStore },
              projectId,
              directory,
            }) => ({
              versionedProjectStore,
              versionedDocumentStore,
              projectId,
              directory,
            })
          ),
          Effect.tap(({ versionedDocumentStore, projectId }) =>
            versionedDocumentStore.setProjectId(projectId)
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
                dbName: directoryPath,
                storeName: AUTOMERGE_DOCUMENTS_STORE_NAME,
                projectId,
              }),
              Effect.flatMap(
                ({ versionedProjectStore, versionedDocumentStore }) =>
                  pipe(
                    openIDB({
                      dbName: directoryPath,
                      documentStoreName: AUTOMERGE_DOCUMENTS_STORE_NAME,
                      metadataStoreName: PROJECT_METADATA_STORE_NAME,
                    }),
                    Effect.flatMap((db) =>
                      validateIdAndOpenProject({
                        projectId,
                        directoryPath,
                        findDocumentById:
                          versionedDocumentStore.findDocumentById,
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
                        db,
                      })
                    ),
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
