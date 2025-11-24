import { type Repo } from '@automerge/automerge-repo/slim';
import Database from 'better-sqlite3';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import { BrowserWindow } from 'electron';

import { createAdapter as createAutomergeDocumentStoreAdapter } from '../../../../../../../../modules/domain/rich-text/adapters/versioned-document-store/automerge/automerge-versioned-document-store';
import { setupSQLiteRepoForNode } from '../../../../../../../../modules/infrastructure/version-control/automerge-repo/node';
import { mapErrorTo } from '../../../../../../../../utils/errors';
import { createDocumentAndProject } from '../../../../../commands/single-document-project';
import { PROJECT_FILE_EXTENSION } from '../../../../../constants/file-extensions';
import { RepositoryError as VersionedProjectRepositoryError } from '../../../../../errors';
import { type ProjectId } from '../../../../../models';
import {
  type OpenSingleDocumentProjectStoreArgs,
  type OpenSingleDocumentProjectStoreDeps,
  type SetupSingleDocumentProjectStoreDeps,
  type SingleDocumentProjectStoreManager,
} from '../../../../../ports';
import { createAdapter as createAutomergeProjectStoreAdapter } from '../../automerge-project-store';

export type ElectronDeps = {
  rendererProcessId: string;
  browserWindow: BrowserWindow;
};

const setupAutomergeRepo = ({
  db,
  filePath,
  rendererProcessId,
  browserWindow,
}: ElectronDeps & {
  db: Database.Database;
  filePath: string;
}): Effect.Effect<Repo, VersionedProjectRepositoryError, never> =>
  Effect.tryPromise({
    try: () =>
      setupSQLiteRepoForNode({
        renderers: new Map([[rendererProcessId, browserWindow]]),
        db,
        filePath,
        initiateSync: false,
      }),
    catch: mapErrorTo(
      VersionedProjectRepositoryError,
      'Error in setting up Automerge repo'
    ),
  });

const setupSQLiteDatabase = (
  filePath: string
): Effect.Effect<Database.Database, VersionedProjectRepositoryError, never> =>
  Effect.try({
    try: () => {
      const db = new Database(filePath);
      db.pragma('journal_mode = WAL');
      return db;
    },
    catch: mapErrorTo(
      VersionedProjectRepositoryError,
      'Error in setting up SQLite database connection'
    ),
  });

const insertProjectMetadataInSQLite = ({
  db,
  projectId,
}: {
  db: Database.Database;
  projectId: ProjectId;
}): Effect.Effect<void, VersionedProjectRepositoryError, never> =>
  Effect.try({
    try: () => {
      db.prepare(
        `CREATE TABLE IF NOT EXISTS project_metadata (
          id TEXT PRIMARY KEY,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`
      ).run();

      db.prepare(
        'INSERT OR REPLACE INTO project_metadata (id, created_at) VALUES (?, CURRENT_TIMESTAMP)'
      ).run(projectId);
    },
    catch: (err) =>
      new VersionedProjectRepositoryError(
        'Error inserting project metadata: ' +
          (err instanceof Error ? err.message : String(err))
      ),
  });

const readProjectMetadataFromSQLite = ({
  db,
}: {
  db: Database.Database;
}): Effect.Effect<ProjectId, VersionedProjectRepositoryError, never> =>
  Effect.try({
    try: () => {
      const row = db
        .prepare('SELECT id FROM project_metadata LIMIT 1')
        .get() as { id?: string } | undefined;

      if (!row || !row.id) {
        throw new Error('No project metadata found in database');
      }

      return row.id as ProjectId;
    },
    catch: (err) =>
      new VersionedProjectRepositoryError(
        'Error reading project metadata: ' +
          (err instanceof Error ? err.message : String(err))
      ),
  });

const openSingleDocumentProjectStoreSemaphore = Effect.runSync(
  Effect.makeSemaphore(1)
);

export const createAdapter = ({
  rendererProcessId,
  browserWindow,
}: ElectronDeps): SingleDocumentProjectStoreManager => {
  let currentAutomergeRepo: Repo | null = null;

  const setupSingleDocumentProjectStore: SingleDocumentProjectStoreManager['setupSingleDocumentProjectStore'] =

      ({ filesystem }: SetupSingleDocumentProjectStoreDeps) =>
      () =>
        Effect.Do.pipe(
          Effect.tap(() =>
            Effect.tryPromise({
              try: async () => {
                if (currentAutomergeRepo) {
                  await currentAutomergeRepo.shutdown();
                  currentAutomergeRepo = null;
                }
              },
              catch: mapErrorTo(
                VersionedProjectRepositoryError,
                'Error in shutting down previous Automerge repo'
              ),
            })
          ),
          Effect.bind('newFile', () =>
            filesystem.createNewFile({
              extensions: [PROJECT_FILE_EXTENSION],
            })
          ),
          Effect.bind('db', ({ newFile }) => setupSQLiteDatabase(newFile.path)),
          Effect.bind('automergeRepo', ({ db, newFile }) =>
            setupAutomergeRepo({
              rendererProcessId,
              browserWindow,
              db,
              filePath: newFile.path,
            })
          ),
          Effect.bind('versionedProjectStore', ({ automergeRepo }) =>
            Effect.succeed(createAutomergeProjectStoreAdapter(automergeRepo))
          ),
          Effect.bind('versionedDocumentStore', ({ automergeRepo }) =>
            Effect.succeed(
              createAutomergeDocumentStoreAdapter({
                automergeRepo,
                filesystem,
                managesFilesystemWorkdir: true,
              })
            )
          ),
          Effect.flatMap(
            ({
              newFile,
              versionedProjectStore,
              versionedDocumentStore,
              db,
              automergeRepo,
            }) =>
              pipe(
                createDocumentAndProject({
                  createDocument: versionedDocumentStore.createDocument,
                  createSingleDocumentProject:
                    versionedProjectStore.createSingleDocumentProject,
                })({
                  content: null,
                }),
                Effect.map(({ documentId, projectId }) => ({
                  versionedProjectStore,
                  versionedDocumentStore,
                  projectId,
                  documentId,
                  file: newFile,
                  // The name is derived by the file name in this case
                  name: newFile.name,
                })),
                Effect.tap(({ projectId }) =>
                  insertProjectMetadataInSQLite({ db, projectId })
                ),
                Effect.tap(({ versionedDocumentStore, projectId }) =>
                  versionedDocumentStore.setProjectId(projectId)
                ),
                Effect.tap(() =>
                  Effect.sync(() => {
                    currentAutomergeRepo = automergeRepo;
                  })
                )
              )
          )
        );

  const openSingleDocumentProjectStore: SingleDocumentProjectStoreManager['openSingleDocumentProjectStore'] =

      ({ filesystem }: OpenSingleDocumentProjectStoreDeps) =>
      ({ fromFile }: OpenSingleDocumentProjectStoreArgs) =>
        openSingleDocumentProjectStoreSemaphore.withPermits(1)(
          Effect.Do.pipe(
            Effect.bind('file', () =>
              fromFile
                ? Effect.succeed(fromFile)
                : filesystem.openFile({ extensions: [PROJECT_FILE_EXTENSION] })
            ),
            Effect.tap(() =>
              Effect.tryPromise({
                try: async () => {
                  if (currentAutomergeRepo) {
                    await currentAutomergeRepo.shutdown();
                    currentAutomergeRepo = null;
                  }
                },
                catch: mapErrorTo(
                  VersionedProjectRepositoryError,
                  'Error in shutting down previous Automerge repo'
                ),
              })
            ),
            Effect.bind('db', ({ file }) => setupSQLiteDatabase(file.path)),
            Effect.bind('projectId', ({ db }) =>
              readProjectMetadataFromSQLite({ db })
            ),
            Effect.bind('automergeRepo', ({ db, file }) =>
              setupAutomergeRepo({
                rendererProcessId,
                browserWindow,
                db,
                filePath: file.path,
              })
            ),
            Effect.bind('versionedProjectStore', ({ automergeRepo }) =>
              Effect.succeed(createAutomergeProjectStoreAdapter(automergeRepo))
            ),
            Effect.bind('versionedDocumentStore', ({ automergeRepo }) =>
              Effect.succeed(
                createAutomergeDocumentStoreAdapter({
                  automergeRepo,
                  filesystem,
                  managesFilesystemWorkdir: true,
                })
              )
            ),
            Effect.bind('documentId', ({ versionedProjectStore, projectId }) =>
              versionedProjectStore.findDocumentInProject(projectId)
            ),
            Effect.tap(({ automergeRepo }) =>
              Effect.sync(() => {
                currentAutomergeRepo = automergeRepo;
              })
            ),
            Effect.tap(({ versionedDocumentStore, projectId }) =>
              versionedDocumentStore.setProjectId(projectId)
            ),
            Effect.map(
              ({
                file,
                versionedProjectStore,
                versionedDocumentStore,
                projectId,
                documentId,
              }) => ({
                versionedProjectStore,
                versionedDocumentStore,
                projectId,
                documentId,
                file,
                // The name is derived by the file name in this case
                name: file.name,
              })
            )
          )
        );

  return {
    setupSingleDocumentProjectStore,
    openSingleDocumentProjectStore,
  };
};
