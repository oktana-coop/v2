import { type Repo } from '@automerge/automerge-repo/slim';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import {
  NotFoundError as VersionedDocumentNotFoundError,
  type RealtimeVersionedDocumentStore,
  RepositoryError as VersionedDocumentRepositoryError,
  ValidationError as VersionedDocumentValidationError,
  type VersionedDocumentStore,
} from '../../../../../../../../modules/domain/rich-text';
import { createAdapter as createAutomergeDocumentStoreAdapter } from '../../../../../../../../modules/domain/rich-text/adapters/versioned-document-store/automerge/automerge-versioned-document-store';
import {
  AccessControlError as FilesystemAccessControlError,
  DataIntegrityError as FilesystemDataIntegrityError,
  type Filesystem,
  NotFoundError as FilesystemNotFoundError,
  RepositoryError as FilesystemRepositoryError,
} from '../../../../../../../../modules/infrastructure/filesystem';
import { MigrationError } from '../../../../../../../../modules/infrastructure/version-control';
import { setupForWeb as setupBrowserRepoForWeb } from '../../../../../../../../modules/infrastructure/version-control/automerge-repo/browser';
import { fromNullable } from '../../../../../../../../utils/effect';
import { mapErrorTo } from '../../../../../../../../utils/errors';
import {
  createProjectFromFilesystemContent,
  updateProjectFromFilesystemContent,
} from '../../../../../commands';
import {
  DataIntegrityError as VersionedProjectDataIntegrityError,
  MissingProjectMetadataError as VersionedProjectMissingProjectMetadataError,
  NotFoundError as VersionedProjectNotFoundError,
  RepositoryError as VersionedProjectRepositoryError,
  ValidationError as VersionedProjectValidationError,
} from '../../../../../errors';
import { parseAutomergeUrl, type ProjectId } from '../../../../../models';
import {
  type MultiDocumentProjectStore,
  type MultiDocumentProjectStoreManager,
} from '../../../../../ports';
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
  filesystem,
  dbName,
  storeName,
  projectId,
}: {
  filesystem: Filesystem;
  dbName: string;
  storeName: string;
  projectId?: ProjectId;
}): Effect.Effect<
  {
    versionedProjectStore: MultiDocumentProjectStore;
    versionedDocumentStore: RealtimeVersionedDocumentStore;
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
      versionedDocumentStore: createAutomergeDocumentStoreAdapter({
        automergeRepo,
        projectId,
        filesystem,
      }),
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
  projectId: ProjectId;
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
  ProjectId,
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
      Effect.try({
        try: () => parseAutomergeUrl(projId),
        catch: mapErrorTo(
          VersionedProjectDataIntegrityError,
          'Malformed project ID found in IndexedDB'
        ),
      })
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
  ProjectId,
  | FilesystemAccessControlError
  | FilesystemDataIntegrityError
  | FilesystemNotFoundError
  | FilesystemRepositoryError
  | VersionedProjectRepositoryError
  | VersionedProjectNotFoundError
  | VersionedProjectValidationError
  | VersionedDocumentRepositoryError
  | VersionedDocumentValidationError,
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
  createDocument,
  deleteDocument,
  updateRichTextDocumentContent,
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
  createDocument: VersionedDocumentStore['createDocument'];
  deleteDocument: VersionedDocumentStore['deleteDocument'];
  updateRichTextDocumentContent: VersionedDocumentStore['updateRichTextDocumentContent'];
  listProjectDocuments: MultiDocumentProjectStore['listProjectDocuments'];
  findDocumentInProject: MultiDocumentProjectStore['findDocumentInProject'];
  deleteDocumentFromProject: MultiDocumentProjectStore['deleteDocumentFromProject'];
  addDocumentToProject: MultiDocumentProjectStore['addDocumentToProject'];
  listDirectoryFiles: Filesystem['listDirectoryFiles'];
  readFile: Filesystem['readFile'];
  db: IDBDatabase;
}): Effect.Effect<
  ProjectId,
  | FilesystemAccessControlError
  | FilesystemDataIntegrityError
  | FilesystemNotFoundError
  | FilesystemRepositoryError
  | VersionedProjectMissingProjectMetadataError
  | VersionedProjectRepositoryError
  | VersionedProjectNotFoundError
  | VersionedProjectDataIntegrityError
  | VersionedProjectValidationError
  | VersionedDocumentRepositoryError
  | VersionedDocumentNotFoundError
  | VersionedDocumentValidationError
  | MigrationError,
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
        createDocument,
        deleteDocument,
        updateRichTextDocumentContent,
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
  createDocument,
  deleteDocument,
  updateRichTextDocumentContent,
  listProjectDocuments,
  findDocumentInProject,
  deleteDocumentFromProject,
  addDocumentToProject,
  listDirectoryFiles,
  readFile,
  db,
}: {
  projectId: ProjectId;
  directoryPath: string;
  findDocumentById: VersionedDocumentStore['findDocumentById'];
  createDocument: VersionedDocumentStore['createDocument'];
  deleteDocument: VersionedDocumentStore['deleteDocument'];
  updateRichTextDocumentContent: VersionedDocumentStore['updateRichTextDocumentContent'];
  listProjectDocuments: MultiDocumentProjectStore['listProjectDocuments'];
  findDocumentInProject: MultiDocumentProjectStore['findDocumentInProject'];
  deleteDocumentFromProject: MultiDocumentProjectStore['deleteDocumentFromProject'];
  addDocumentToProject: MultiDocumentProjectStore['addDocumentToProject'];
  listDirectoryFiles: Filesystem['listDirectoryFiles'];
  readFile: Filesystem['readFile'];
  db: IDBDatabase;
}): Effect.Effect<
  ProjectId,
  | FilesystemAccessControlError
  | FilesystemDataIntegrityError
  | FilesystemNotFoundError
  | FilesystemRepositoryError
  | VersionedProjectMissingProjectMetadataError
  | VersionedProjectRepositoryError
  | VersionedProjectNotFoundError
  | VersionedProjectDataIntegrityError
  | VersionedProjectValidationError
  | VersionedDocumentRepositoryError
  | VersionedDocumentNotFoundError
  | VersionedDocumentValidationError
  | MigrationError,
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
        createDocument,
        deleteDocument,
        updateRichTextDocumentContent,
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

      ({ filesystem }) =>
      () =>
        Effect.Do.pipe(
          Effect.bind('directory', () => filesystem.openDirectory()),
          Effect.bind('db', ({ directory }) =>
            openIDB({
              dbName: directory.path,
              documentStoreName: AUTOMERGE_DOCUMENTS_STORE_NAME,
              metadataStoreName: PROJECT_METADATA_STORE_NAME,
            })
          ),
          Effect.bind('storeData', ({ directory }) =>
            setupAutomergeRepoAndStores({
              filesystem,
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
                  createDocument: versionedDocumentStore.createDocument,
                  deleteDocument: versionedDocumentStore.deleteDocument,
                  updateRichTextDocumentContent:
                    versionedDocumentStore.updateRichTextDocumentContent,
                  listProjectDocuments:
                    versionedProjectStore.listProjectDocuments,
                  findDocumentInProject:
                    versionedProjectStore.findDocumentInProject,
                  deleteDocumentFromProject:
                    versionedProjectStore.deleteDocumentFromProject,
                  addDocumentToProject:
                    versionedProjectStore.addDocumentToProject,
                  listDirectoryFiles: filesystem.listDirectoryFiles,
                  readFile: filesystem.readFile,
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
                      listDirectoryFiles: filesystem.listDirectoryFiles,
                      readFile: filesystem.readFile,
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

      ({ filesystem }) =>
      ({ projectId, directoryPath }) =>
        pipe(
          filesystem.getDirectory(directoryPath),
          Effect.flatMap((directory) =>
            pipe(
              setupAutomergeRepoAndStores({
                filesystem,
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
                        createDocument: versionedDocumentStore.createDocument,
                        deleteDocument: versionedDocumentStore.deleteDocument,
                        updateRichTextDocumentContent:
                          versionedDocumentStore.updateRichTextDocumentContent,
                        listProjectDocuments:
                          versionedProjectStore.listProjectDocuments,
                        findDocumentInProject:
                          versionedProjectStore.findDocumentInProject,
                        deleteDocumentFromProject:
                          versionedProjectStore.deleteDocumentFromProject,
                        addDocumentToProject:
                          versionedProjectStore.addDocumentToProject,
                        listDirectoryFiles: filesystem.listDirectoryFiles,
                        readFile: filesystem.readFile,
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
