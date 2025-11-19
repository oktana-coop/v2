import Database from 'better-sqlite3';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import { createAdapter as createVersionedDocumentStoreAdapter } from '../../../../../../../../modules/domain/rich-text/adapters/versioned-document-store/git/git-versioned-document-store';
import {
  createAdapter as createSQLiteFilesystemAdapter,
  createNodeLikeFsSQLiteAdapter,
} from '../../../../../../../../modules/infrastructure/filesystem/adapters/sqlite-fs';
import { SQLite3IsoGitFs } from '../../../../../../../../modules/infrastructure/version-control/git-lib/isogit-sqlite-fs';
import { mapErrorTo } from '../../../../../../../../utils/errors';
import { createDocumentAndProject } from '../../../../../commands/single-document-project';
import { PROJECT_FILE_EXTENSION } from '../../../../../constants/file-extensions';
import { RepositoryError as VersionedProjectRepositoryError } from '../../../../../errors';
import { parseProjectFsPath } from '../../../../../models';
import {
  type OpenSingleDocumentProjectStoreArgs,
  type OpenSingleDocumentProjectStoreDeps,
  type SetupSingleDocumentProjectStoreDeps,
  type SingleDocumentProjectStoreManager,
} from '../../../../../ports';
import { DOCUMENT_INTERNAL_PATH } from '../../document-internal-path';
import { createAdapter as createSingleDocumentProjectStoreAdapter } from '../../git-project-store';

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

const openSingleDocumentProjectStoreSemaphore = Effect.runSync(
  Effect.makeSemaphore(1)
);

export const createAdapter = (): SingleDocumentProjectStoreManager => {
  const setupSingleDocumentProjectStore: SingleDocumentProjectStoreManager['setupSingleDocumentProjectStore'] =

      ({ filesystem }: SetupSingleDocumentProjectStoreDeps) =>
      () =>
        Effect.Do.pipe(
          Effect.bind('newFile', () =>
            filesystem.createNewFile({
              extensions: [PROJECT_FILE_EXTENSION],
            })
          ),
          Effect.bind('db', ({ newFile }) => setupSQLiteDatabase(newFile.path)),
          Effect.bind('isoGitFs', ({ db }) =>
            Effect.succeed(new SQLite3IsoGitFs(db))
          ),
          Effect.bind('filesystem', ({ db }) =>
            pipe(
              Effect.succeed(createNodeLikeFsSQLiteAdapter(db)),
              Effect.flatMap((nodeLikeFs) =>
                Effect.succeed(createSQLiteFilesystemAdapter(nodeLikeFs))
              )
            )
          ),
          Effect.bind('projectFilePath', ({ newFile }) =>
            Effect.try({
              try: () => parseProjectFsPath(newFile.path),
              catch: mapErrorTo(
                VersionedProjectRepositoryError,
                'Invalid project path'
              ),
            })
          ),
          Effect.bind(
            'versionedProjectStore',
            ({ newFile, isoGitFs, filesystem, projectFilePath }) =>
              Effect.succeed(
                createSingleDocumentProjectStoreAdapter({
                  isoGitFs,
                  filesystem,
                  projectFilePath,
                  projectName: newFile.name,
                  documentInternalPath: DOCUMENT_INTERNAL_PATH,
                })
              )
          ),
          Effect.bind(
            'versionedDocumentStore',
            ({ isoGitFs, filesystem, projectFilePath }) =>
              Effect.succeed(
                createVersionedDocumentStoreAdapter({
                  isoGitFs,
                  filesystem,
                  projectId: projectFilePath,
                  projectDir: '/',
                })
              )
          ),
          Effect.flatMap(
            ({ newFile, versionedProjectStore, versionedDocumentStore }) =>
              pipe(
                createDocumentAndProject({
                  createDocument: versionedDocumentStore.createDocument,
                  createSingleDocumentProject:
                    versionedProjectStore.createSingleDocumentProject,
                })({
                  content: null,
                  writeToFileWithPath: DOCUMENT_INTERNAL_PATH,
                }),
                Effect.map(({ documentId, projectId }) => ({
                  versionedProjectStore,
                  versionedDocumentStore,
                  projectId,
                  documentId,
                  file: newFile,
                  // The name is derived by the file name in this case
                  name: newFile.name,
                }))
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
            Effect.bind('db', ({ file }) => setupSQLiteDatabase(file.path)),
            Effect.bind('isoGitFs', ({ db }) =>
              Effect.succeed(new SQLite3IsoGitFs(db))
            ),
            Effect.bind('filesystem', ({ db }) =>
              pipe(
                Effect.succeed(createNodeLikeFsSQLiteAdapter(db)),
                Effect.flatMap((nodeLikeFs) =>
                  Effect.succeed(createSQLiteFilesystemAdapter(nodeLikeFs))
                )
              )
            ),
            Effect.bind('projectFilePath', ({ file }) =>
              Effect.try({
                try: () => parseProjectFsPath(file.path),
                catch: mapErrorTo(
                  VersionedProjectRepositoryError,
                  'Invalid project path'
                ),
              })
            ),
            Effect.bind(
              'versionedProjectStore',
              ({ file, isoGitFs, filesystem, projectFilePath }) =>
                Effect.succeed(
                  createSingleDocumentProjectStoreAdapter({
                    isoGitFs,
                    filesystem,
                    projectFilePath,
                    projectName: file.name,
                    documentInternalPath: DOCUMENT_INTERNAL_PATH,
                  })
                )
            ),
            Effect.bind(
              'versionedDocumentStore',
              ({ isoGitFs, filesystem, projectFilePath }) =>
                Effect.succeed(
                  createVersionedDocumentStoreAdapter({
                    isoGitFs,
                    filesystem,
                    projectId: projectFilePath,
                    projectDir: '/',
                  })
                )
            ),
            Effect.bind(
              'documentId',
              ({ versionedProjectStore, projectFilePath }) =>
                versionedProjectStore.findDocumentInProject(projectFilePath)
            ),
            Effect.map(
              ({
                file,
                versionedProjectStore,
                versionedDocumentStore,
                projectFilePath: projectId,
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
