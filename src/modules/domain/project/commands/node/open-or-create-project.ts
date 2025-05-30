import { promises as fs } from 'node:fs';
import { join } from 'node:path';

import { type Repo } from '@automerge/automerge-repo/slim';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import { BrowserWindow } from 'electron';

import {
  NotFoundError as VersionedDocumentNotFoundError,
  RepositoryError as VersionedDocumentRepositoryError,
} from '../../../../../modules/domain/rich-text';
import { createAdapter as createAutomergeVersionedDocumentStoreAdapter } from '../../../../../modules/domain/rich-text/adapters/automerge-versioned-document-store';
import {
  isValidVersionControlId,
  type VersionControlId,
} from '../../../../../modules/infrastructure/version-control';
import { setupForNode as setupAutomergeRepoForNode } from '../../../../../modules/infrastructure/version-control/automerge-repo/node';
import { fromNullable } from '../../../../../utils/effect';
import { mapErrorTo } from '../../../../../utils/errors';
import {
  AccessControlError as FilesystemAccessControlError,
  DataIntegrityError as FilesystemDataIntegrityError,
  type Filesystem,
  NotFoundError as FilesystemNotFoundError,
  RepositoryError as FilesystemRepositoryError,
} from '../../../../infrastructure/filesystem';
import { createAdapter as createAutomergeVersionedProjectStoreAdapter } from '../../adapters/automerge-versioned-project-store';
import {
  createProjectFromFilesystemContent,
  updateProjectFromFilesystemContent,
} from '../../commands';
import {
  DataIntegrityError as VersionedProjectDataIntegrityError,
  MissingIndexFileError as VersionedProjectMissingIndexFileError,
  NotFoundError as VersionedProjectNotFoundError,
  RepositoryError as VersionedProjectRepositoryError,
} from '../../errors';

const setupAutomergeRepo = ({
  directoryPath,
  rendererProcessId,
  browserWindow,
}: {
  directoryPath: string;
  rendererProcessId: string;
  browserWindow: BrowserWindow;
}): Effect.Effect<Repo, VersionedProjectRepositoryError, never> =>
  Effect.tryPromise({
    try: () =>
      setupAutomergeRepoForNode({
        processId: 'main',
        directoryPath: join(directoryPath, '.v2', 'automerge'),
        renderers: new Map([[rendererProcessId, browserWindow]]),
      }),
    catch: mapErrorTo(
      VersionedProjectRepositoryError,
      'Error in setting up Automerge repo'
    ),
  });

const openProject = ({
  projectId,
  directoryPath,
  rendererProcessId,
  browserWindow,
  listDirectoryFiles,
  readFile,
}: {
  projectId: VersionControlId;
  directoryPath: string;
  rendererProcessId: string;
  browserWindow: BrowserWindow;
  listDirectoryFiles: Filesystem['listDirectoryFiles'];
  readFile: Filesystem['readFile'];
}): Effect.Effect<
  void,
  | FilesystemAccessControlError
  | FilesystemDataIntegrityError
  | FilesystemNotFoundError
  | FilesystemRepositoryError
  | VersionedProjectRepositoryError
  | VersionedProjectNotFoundError
  | VersionedDocumentRepositoryError
  | VersionedDocumentNotFoundError,
  never
> =>
  pipe(
    setupAutomergeRepo({
      directoryPath,
      rendererProcessId,
      browserWindow,
    }),
    Effect.map((automergeRepo) => ({
      versionedProjectStore:
        createAutomergeVersionedProjectStoreAdapter(automergeRepo),
      versionedDocumentStore:
        createAutomergeVersionedDocumentStoreAdapter(automergeRepo),
    })),
    Effect.flatMap(({ versionedProjectStore, versionedDocumentStore }) =>
      updateProjectFromFilesystemContent({
        findDocumentById: versionedDocumentStore.findDocumentById,
        getDocumentFromHandle: versionedDocumentStore.getDocumentFromHandle,
        createDocument: versionedDocumentStore.createDocument,
        deleteDocument: versionedDocumentStore.deleteDocument,
        updateDocumentSpans: versionedDocumentStore.updateDocumentSpans,
        listProjectDocuments: versionedProjectStore.listProjectDocuments,
        findDocumentInProject: versionedProjectStore.findDocumentInProject,
        deleteDocumentFromProject:
          versionedProjectStore.deleteDocumentFromProject,
        addDocumentToProject: versionedProjectStore.addDocumentToProject,
        listDirectoryFiles,
        readFile,
      })({ projectId, directoryPath })
    )
  );

const readProjectIdFromDirIndexFile = ({
  directoryPath,
  readFile,
}: {
  directoryPath: string;
  readFile: Filesystem['readFile'];
}): Effect.Effect<
  VersionControlId,
  | FilesystemAccessControlError
  | FilesystemRepositoryError
  | VersionedProjectMissingIndexFileError
  | VersionedProjectDataIntegrityError,
  never
> => {
  const indexFilePath = join(directoryPath, '.v2', 'index.txt');

  return pipe(
    readFile(indexFilePath),
    Effect.catchTag('FilesystemNotFoundError', () =>
      Effect.fail(
        new VersionedProjectMissingIndexFileError(
          'Index file not found in the specified directory'
        )
      )
    ),
    Effect.map((file) => file.content),
    Effect.flatMap((content) =>
      fromNullable(
        content,
        () =>
          new VersionedProjectDataIntegrityError(
            'Project ID not found in index file'
          )
      )
    ),
    Effect.flatMap((projectId) =>
      isValidVersionControlId(projectId)
        ? Effect.succeed(projectId)
        : Effect.fail(
            new VersionedProjectDataIntegrityError(
              'Project ID found in index file is invalid Automerge URL'
            )
          )
    )
  );
};

const openProjectFromFilesystem = ({
  directoryPath,
  rendererProcessId,
  browserWindow,
  listDirectoryFiles,
  readFile,
  assertWritePermissionForDirectory,
}: {
  directoryPath: string;
  rendererProcessId: string;
  browserWindow: BrowserWindow;
  listDirectoryFiles: Filesystem['listDirectoryFiles'];
  readFile: Filesystem['readFile'];
  assertWritePermissionForDirectory: Filesystem['assertWritePermissionForDirectory'];
}): Effect.Effect<
  VersionControlId,
  | FilesystemAccessControlError
  | FilesystemDataIntegrityError
  | FilesystemNotFoundError
  | FilesystemRepositoryError
  | VersionedProjectMissingIndexFileError
  | VersionedProjectRepositoryError
  | VersionedProjectNotFoundError
  | VersionedProjectDataIntegrityError
  | VersionedDocumentRepositoryError
  | VersionedDocumentNotFoundError,
  never
> =>
  pipe(
    assertWritePermissionForDirectory(directoryPath),
    Effect.flatMap(() =>
      readProjectIdFromDirIndexFile({ directoryPath, readFile })
    ),
    Effect.tap((projectId) =>
      openProject({
        projectId,
        directoryPath,
        rendererProcessId,
        browserWindow,
        listDirectoryFiles,
        readFile,
      })
    )
  );

export const openProjectById = ({
  projectId,
  directoryPath,
  rendererProcessId,
  browserWindow,
  listDirectoryFiles,
  readFile,
  assertWritePermissionForDirectory,
}: {
  projectId: VersionControlId;
  directoryPath: string;
  rendererProcessId: string;
  browserWindow: BrowserWindow;
  listDirectoryFiles: Filesystem['listDirectoryFiles'];
  readFile: Filesystem['readFile'];
  assertWritePermissionForDirectory: Filesystem['assertWritePermissionForDirectory'];
}): Effect.Effect<
  void,
  | FilesystemAccessControlError
  | FilesystemDataIntegrityError
  | FilesystemNotFoundError
  | FilesystemRepositoryError
  | VersionedProjectMissingIndexFileError
  | VersionedProjectRepositoryError
  | VersionedProjectNotFoundError
  | VersionedProjectDataIntegrityError
  | VersionedDocumentRepositoryError
  | VersionedDocumentNotFoundError,
  never
> =>
  pipe(
    assertWritePermissionForDirectory(directoryPath),
    Effect.flatMap(() =>
      readProjectIdFromDirIndexFile({ directoryPath, readFile })
    ),
    Effect.flatMap((filesystemProjectId) =>
      filesystemProjectId === projectId
        ? Effect.succeed(projectId)
        : Effect.fail(
            new VersionedProjectDataIntegrityError(
              'The project ID in the filesystem is different than the one the app is trying to open'
            )
          )
    ),
    Effect.flatMap((projectId) =>
      openProject({
        projectId,
        directoryPath,
        rendererProcessId,
        browserWindow,
        listDirectoryFiles,
        readFile,
      })
    )
  );

// TODO: Move to filesystem repository as soon as we find a good way to manage it for the browser case
// Note: This is really not needed in the browser case right now because we are using an IndexedDB repo currently.
// But we are trying to keep the Filesystem API consistent across browser and Node to avoid the extra complexity.
const createSubDirectory = ({
  parentDirectoryPath,
  subDirectory,
}: {
  parentDirectoryPath: string;
  subDirectory: string;
}): Effect.Effect<void, FilesystemRepositoryError, never> =>
  pipe(
    Effect.tryPromise({
      try: () =>
        fs.mkdir(join(parentDirectoryPath, subDirectory), { recursive: true }),
      catch: mapErrorTo(
        FilesystemRepositoryError,
        'Error creating hidden directory for version control repo'
      ),
    }),
    Effect.as(undefined)
  );

const writeIndexFile = ({
  rootDirectoryPath,
  projectId,
  writeFile,
}: {
  rootDirectoryPath: string;
  projectId: VersionControlId;
  writeFile: Filesystem['writeFile'];
}): Effect.Effect<
  void,
  | FilesystemAccessControlError
  | FilesystemNotFoundError
  | FilesystemRepositoryError,
  never
> => {
  const indexFilePath = join(rootDirectoryPath, '.v2', 'index.txt');
  return writeFile(indexFilePath, projectId);
};

const createNewProject = ({
  directoryPath,
  rendererProcessId,
  browserWindow,
  listDirectoryFiles,
  readFile,
  writeFile,
}: {
  directoryPath: string;
  rendererProcessId: string;
  browserWindow: BrowserWindow;
  listDirectoryFiles: Filesystem['listDirectoryFiles'];
  readFile: Filesystem['readFile'];
  writeFile: Filesystem['writeFile'];
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
    createSubDirectory({
      parentDirectoryPath: directoryPath,
      subDirectory: '.v2',
    }),
    Effect.flatMap(() =>
      setupAutomergeRepo({
        directoryPath,
        rendererProcessId,
        browserWindow,
      })
    ),
    Effect.map((automergeRepo) => ({
      versionedProjectStore:
        createAutomergeVersionedProjectStoreAdapter(automergeRepo),
      versionedDocumentStore:
        createAutomergeVersionedDocumentStoreAdapter(automergeRepo),
    })),
    Effect.flatMap(({ versionedDocumentStore, versionedProjectStore }) =>
      createProjectFromFilesystemContent({
        createDocument: versionedDocumentStore.createDocument,
        createProject: versionedProjectStore.createProject,
        addDocumentToProject: versionedProjectStore.addDocumentToProject,
        listDirectoryFiles,
        readFile,
      })({ directoryPath })
    ),
    Effect.tap((projectId) =>
      writeIndexFile({ rootDirectoryPath: directoryPath, projectId, writeFile })
    )
  );

export const openOrCreateProject = ({
  directoryPath,
  rendererProcessId,
  browserWindow,
  listDirectoryFiles,
  readFile,
  writeFile,
  assertWritePermissionForDirectory,
}: {
  directoryPath: string;
  rendererProcessId: string;
  browserWindow: BrowserWindow;
  listDirectoryFiles: Filesystem['listDirectoryFiles'];
  readFile: Filesystem['readFile'];
  writeFile: Filesystem['writeFile'];
  assertWritePermissionForDirectory: Filesystem['assertWritePermissionForDirectory'];
}): Effect.Effect<
  VersionControlId,
  | FilesystemAccessControlError
  | FilesystemDataIntegrityError
  | FilesystemNotFoundError
  | FilesystemRepositoryError
  | VersionedProjectRepositoryError
  | VersionedProjectNotFoundError
  | VersionedProjectDataIntegrityError
  | VersionedDocumentRepositoryError
  | VersionedDocumentNotFoundError,
  never
> =>
  pipe(
    openProjectFromFilesystem({
      directoryPath,
      rendererProcessId,
      browserWindow,
      listDirectoryFiles,
      readFile,
      assertWritePermissionForDirectory,
    }),
    Effect.catchIf(
      (error) =>
        error instanceof FilesystemNotFoundError ||
        error instanceof FilesystemAccessControlError ||
        error instanceof VersionedProjectMissingIndexFileError,
      // Directory does not exist or can't be accessed.
      // Create a new repo & project
      () =>
        createNewProject({
          directoryPath,
          rendererProcessId,
          browserWindow,
          listDirectoryFiles,
          readFile,
          writeFile,
        })
    )
  );
