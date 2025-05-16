import { promises as fs } from 'node:fs';
import { join } from 'node:path';

import { type Repo } from '@automerge/automerge-repo/slim';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import { BrowserWindow } from 'electron';

import { fromNullable } from '../../../../utils/effect';
import { mapErrorTo } from '../../../../utils/errors';
import {
  AccessControlError as FilesystemAccessControlError,
  DataIntegrityError as FilesystemDataIntegrityError,
  type Filesystem,
  NotFoundError as FilesystemNotFoundError,
  RepositoryError as FilesystemRepositoryError,
} from '../../../filesystem';
import { createAdapter as createAutomergeVersionControlAdapter } from '../../adapters/automerge';
import {
  createProjectFromFilesystemContent,
  updateProjectFromFilesystemContent,
} from '../../commands';
import {
  DataIntegrityError as VersionControlDataIntegrityError,
  MissingIndexFileError as VersionControlMissingIndexFileError,
  NotFoundError as VersionControlNotFoundError,
  RepositoryError as VersionControlRepositoryError,
} from '../../errors';
import { isValidVersionControlId, type VersionControlId } from '../../models';
import { setup as setupNodeRepo } from './setup';

const setupAutomergeRepo = ({
  directoryPath,
  rendererProcessId,
  browserWindow,
}: {
  directoryPath: string;
  rendererProcessId: string;
  browserWindow: BrowserWindow;
}): Effect.Effect<Repo, VersionControlRepositoryError, never> =>
  Effect.tryPromise({
    try: () =>
      setupNodeRepo({
        processId: 'main',
        directoryPath: join(directoryPath, '.v2', 'automerge'),
        renderers: new Map([[rendererProcessId, browserWindow]]),
      }),
    catch: mapErrorTo(
      VersionControlRepositoryError,
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
  | VersionControlRepositoryError
  | VersionControlNotFoundError,
  never
> =>
  pipe(
    setupAutomergeRepo({
      directoryPath,
      rendererProcessId,
      browserWindow,
    }),
    Effect.map(createAutomergeVersionControlAdapter),
    Effect.flatMap((versionControlRepo) =>
      updateProjectFromFilesystemContent({
        createDocument: versionControlRepo.createDocument,
        listProjectDocuments: versionControlRepo.listProjectDocuments,
        findDocumentInProject: versionControlRepo.findDocumentInProject,
        getDocumentFromHandle: versionControlRepo.getDocumentFromHandle,
        deleteDocumentFromProject: versionControlRepo.deleteDocumentFromProject,
        updateDocumentSpans: versionControlRepo.updateDocumentSpans,
        listDirectoryFiles: listDirectoryFiles,
        readFile: readFile,
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
  | VersionControlMissingIndexFileError
  | VersionControlDataIntegrityError,
  never
> => {
  const indexFilePath = join(directoryPath, '.v2', 'index.txt');

  return pipe(
    readFile(indexFilePath),
    Effect.catchTag('NotFoundError', () =>
      Effect.fail(
        new VersionControlMissingIndexFileError(
          'Index file not found in the specified directory'
        )
      )
    ),
    Effect.map((file) => file.content),
    Effect.flatMap((content) =>
      fromNullable(
        content,
        () =>
          new VersionControlDataIntegrityError(
            'Project ID not found in index file'
          )
      )
    ),
    Effect.flatMap((projectId) =>
      isValidVersionControlId(projectId)
        ? Effect.succeed(projectId)
        : Effect.fail(
            new VersionControlDataIntegrityError(
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
  | VersionControlMissingIndexFileError
  | VersionControlRepositoryError
  | VersionControlNotFoundError
  | VersionControlDataIntegrityError,
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
  | VersionControlMissingIndexFileError
  | VersionControlRepositoryError
  | VersionControlNotFoundError
  | VersionControlDataIntegrityError,
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
            new VersionControlDataIntegrityError(
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
  | VersionControlRepositoryError
  | VersionControlNotFoundError,
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
    Effect.map(createAutomergeVersionControlAdapter),
    Effect.flatMap((versionControlRepo) =>
      createProjectFromFilesystemContent({
        createProject: versionControlRepo.createProject,
        createDocument: versionControlRepo.createDocument,
        listDirectoryFiles: listDirectoryFiles,
        readFile: readFile,
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
  | VersionControlRepositoryError
  | VersionControlNotFoundError,
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
        error instanceof VersionControlMissingIndexFileError,
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
