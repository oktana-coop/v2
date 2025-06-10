import { type Repo } from '@automerge/automerge-repo/slim';
import Database from 'better-sqlite3';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import { BrowserWindow } from 'electron';

import { createAdapter as createAutomergeDocumentStoreAdapter } from '../../../../../../../modules/domain/rich-text/adapters/automerge-versioned-document-store';
import { type VersionControlId } from '../../../../../../../modules/infrastructure/version-control';
import { setupSQLiteRepoForNode } from '../../../../../../../modules/infrastructure/version-control/automerge-repo/node';
import { mapErrorTo } from '../../../../../../../utils/errors';
import { createDocumentAndProject } from '../../../../commands/single-document-project';
import { RepositoryError as VersionedProjectRepositoryError } from '../../../../errors';
import {
  type OpenSingleDocumentProjectStoreDeps,
  type SetupSingleDocumentProjectStoreArgs,
  type SetupSingleDocumentProjectStoreDeps,
  type SingleDocumentProjectStoreManager,
} from '../../../../ports';
import { createAdapter as createAutomergeProjectStoreAdapter } from '../../automerge-project-store';

export type ElectronDeps = {
  rendererProcessId: string;
  browserWindow: BrowserWindow;
};

const setupAutomergeRepo = ({
  db,
  rendererProcessId,
  browserWindow,
}: ElectronDeps & {
  db: Database.Database;
}): Effect.Effect<Repo, VersionedProjectRepositoryError, never> =>
  Effect.tryPromise({
    try: () =>
      setupSQLiteRepoForNode({
        processId: 'main',
        renderers: new Map([[rendererProcessId, browserWindow]]),
        db,
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
  projectId: VersionControlId;
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
}): Effect.Effect<VersionControlId, VersionedProjectRepositoryError, never> =>
  Effect.try({
    try: () => {
      const row = db
        .prepare('SELECT id FROM project_metadata LIMIT 1')
        .get() as { id?: string } | undefined;

      if (!row || !row.id) {
        throw new Error('No project metadata found in database');
      }

      return row.id as VersionControlId;
    },
    catch: (err) =>
      new VersionedProjectRepositoryError(
        'Error reading project metadata: ' +
          (err instanceof Error ? err.message : String(err))
      ),
  });

export const createAdapter = ({
  rendererProcessId,
  browserWindow,
}: ElectronDeps): SingleDocumentProjectStoreManager => {
  const setupSingleDocumentProjectStore: SingleDocumentProjectStoreManager['setupSingleDocumentProjectStore'] =

      ({ createNewFile }: SetupSingleDocumentProjectStoreDeps) =>
      ({ suggestedName }: SetupSingleDocumentProjectStoreArgs) =>
        Effect.Do.pipe(
          Effect.bind('newFile', () => createNewFile(suggestedName)),
          Effect.bind('db', ({ newFile }) =>
            setupSQLiteDatabase(newFile.path!)
          ),
          Effect.bind('automergeRepo', ({ db }) =>
            setupAutomergeRepo({
              rendererProcessId,
              browserWindow,
              db,
            })
          ),
          Effect.bind('versionedProjectStore', ({ automergeRepo }) =>
            Effect.succeed(createAutomergeProjectStoreAdapter(automergeRepo))
          ),
          Effect.bind('versionedDocumentStore', ({ automergeRepo }) =>
            Effect.succeed(createAutomergeDocumentStoreAdapter(automergeRepo))
          ),
          Effect.flatMap(
            ({ newFile, versionedProjectStore, versionedDocumentStore, db }) =>
              pipe(
                createDocumentAndProject({
                  createDocument: versionedDocumentStore.createDocument,
                  createSingleDocumentProject:
                    versionedProjectStore.createSingleDocumentProject,
                })({
                  title: suggestedName,
                  content: null,
                }),
                Effect.map(({ documentId, projectId }) => ({
                  versionedProjectStore,
                  versionedDocumentStore,
                  filePath: newFile.path!,
                  projectId,
                  documentId,
                })),
                Effect.tap(({ projectId }) =>
                  insertProjectMetadataInSQLite({ db, projectId })
                )
              )
          )
        );

  const openSingleDocumentProjectStore: SingleDocumentProjectStoreManager['openSingleDocumentProjectStore'] =

      ({ openFile }: OpenSingleDocumentProjectStoreDeps) =>
      () =>
        Effect.Do.pipe(
          Effect.bind('file', () => openFile()),
          Effect.bind('db', ({ file }) => setupSQLiteDatabase(file.path!)),
          Effect.bind('projectId', ({ db }) =>
            readProjectMetadataFromSQLite({ db })
          ),
          Effect.bind('automergeRepo', ({ db }) =>
            setupAutomergeRepo({
              rendererProcessId,
              browserWindow,
              db,
            })
          ),
          Effect.bind('versionedProjectStore', ({ automergeRepo }) =>
            Effect.succeed(createAutomergeProjectStoreAdapter(automergeRepo))
          ),
          Effect.bind('versionedDocumentStore', ({ automergeRepo }) =>
            Effect.succeed(createAutomergeDocumentStoreAdapter(automergeRepo))
          ),
          Effect.bind('documentId', ({ versionedProjectStore, projectId }) =>
            versionedProjectStore.findDocumentInProject(projectId)
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
              filePath: file.path!,
            })
          )
        );

  return {
    setupSingleDocumentProjectStore,
    openSingleDocumentProjectStore,
  };
};
