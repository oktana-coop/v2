import Database from 'better-sqlite3';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import http from 'isomorphic-git/http/node';

import { createAdapter as createVersionedDocumentStoreAdapter } from '../../../../../../../../modules/domain/rich-text/adapters/versioned-document-store/git/git-versioned-document-store';
import {
  createAdapter as createSQLiteFilesystemAdapter,
  createNodeLikeFsSQLiteAdapter,
} from '../../../../../../../../modules/infrastructure/filesystem/adapters/sqlite-fs';
import { SQLite3IsoGitFs } from '../../../../../../../../modules/infrastructure/version-control/git-lib/isogit-sqlite-fs';
import { mapErrorTo } from '../../../../../../../../utils/errors';
import { createDocumentAndProject } from '../../../../../commands/single-document-project';
import {
  DOCUMENT_INTERNAL_PATH,
  PROJECT_FILE_EXTENSION,
} from '../../../../../constants';
import { RepositoryError as VersionedProjectRepositoryError } from '../../../../../errors';
import { parseProjectFsPath } from '../../../../../models';
import {
  type OpenSingleDocumentProjectStoreArgs,
  type OpenSingleDocumentProjectStoreDeps,
  type SetupSingleDocumentProjectStoreDeps,
  type SingleDocumentProjectStoreManager,
} from '../../../../../ports';
import { createAdapter as createSingleDocumentProjectStoreAdapter } from '../../git-project-store';

// This will passed as the workdir in the SQLite virtual filesystem.
// We use the current directory ('.') so that all paths stay relative.
const INTERNAL_PROJECT_DIR = '.';

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
      ({ username, email }) =>
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
                  isoGitHttp: http,
                  projectFilePath,
                  internalProjectDir: INTERNAL_PROJECT_DIR,
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
                  projectDir: INTERNAL_PROJECT_DIR,
                  managesFilesystemWorkdir: true,
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
                  getCurrentBranch: versionedProjectStore.getCurrentBranch,
                })({
                  content: null,
                  writeToFileWithPath: DOCUMENT_INTERNAL_PATH,
                  username,
                  email,
                }),
                Effect.map(({ documentId, projectId, currentBranch }) => ({
                  versionedProjectStore,
                  versionedDocumentStore,
                  projectId,
                  documentId,
                  currentBranch,
                  remoteProjects: [],
                  file: newFile,
                  // The name is derived by the file name in this case
                  name: newFile.name,
                }))
              )
          )
        );

  const openSingleDocumentProjectStore: SingleDocumentProjectStoreManager['openSingleDocumentProjectStore'] =

      ({ filesystem }: OpenSingleDocumentProjectStoreDeps) =>
      ({ fromFile, username, email }: OpenSingleDocumentProjectStoreArgs) =>
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
                    isoGitHttp: http,
                    projectFilePath,
                    internalProjectDir: INTERNAL_PROJECT_DIR,
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
                    projectDir: INTERNAL_PROJECT_DIR,
                    managesFilesystemWorkdir: true,
                  })
                )
            ),
            Effect.bind(
              'documentId',
              ({ versionedProjectStore, projectFilePath }) =>
                versionedProjectStore.findDocumentInProject(projectFilePath)
            ),
            Effect.bind(
              'currentBranch',
              ({ versionedProjectStore, projectFilePath: projectId }) =>
                versionedProjectStore.getCurrentBranch({ projectId })
            ),
            Effect.bind(
              'remoteProjects',
              ({ versionedProjectStore, projectFilePath: projectId }) =>
                versionedProjectStore.listRemoteProjects({ projectId })
            ),
            Effect.tap(
              ({ versionedProjectStore, projectFilePath: projectId }) =>
                versionedProjectStore.setAuthorInfo({
                  projectId,
                  username,
                  email,
                })
            ),
            Effect.map(
              ({
                file,
                versionedProjectStore,
                versionedDocumentStore,
                projectFilePath: projectId,
                documentId,
                currentBranch,
                remoteProjects,
              }) => ({
                versionedProjectStore,
                versionedDocumentStore,
                projectId,
                documentId,
                currentBranch,
                remoteProjects,
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
