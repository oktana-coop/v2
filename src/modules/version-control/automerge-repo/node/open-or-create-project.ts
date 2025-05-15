import { promises as fs } from 'node:fs';
import { join } from 'node:path';

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
  NotFoundError as VersionControlNotFoundError,
  RepositoryError as VersionControlRepositoryError,
} from '../../errors';
import { isValidVersionControlId, type VersionControlId } from '../../models';
import { setup as setupNodeRepo } from './setup';

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
  | FilesystemNotFoundError
  | FilesystemRepositoryError
  | VersionControlDataIntegrityError,
  never
> => {
  const indexFilePath = join(directoryPath, '.v2', 'index.txt');

  return pipe(
    readFile(indexFilePath),
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

const createNewProject = async ({
  directoryPath,
  rendererProcessId,
  browserWindow,
  listDirectoryFiles,
  readFile,
}: {
  directoryPath: string;
  rendererProcessId: string;
  browserWindow: BrowserWindow;
  listDirectoryFiles: Filesystem['listDirectoryFiles'];
  readFile: Filesystem['readFile'];
}): Promise<VersionControlId> => {
  await fs.mkdir(join(directoryPath, '.v2'), { recursive: true });

  // Setup the version control repository
  const automergeRepo = await setupNodeRepo({
    processId: 'main',
    directoryPath: join(directoryPath, '.v2', 'automerge'),
    renderers: new Map([[rendererProcessId, browserWindow]]),
  });

  const versionControlRepo =
    createAutomergeVersionControlAdapter(automergeRepo);

  const projectId = await createProjectFromFilesystemContent({
    createProject: versionControlRepo.createProject,
    createDocument: versionControlRepo.createDocument,
    listDirectoryFiles: listDirectoryFiles,
    readFile: readFile,
  })({ directoryPath });

  const indexFilePath = join(directoryPath, '.v2', 'index.txt');
  await fs.writeFile(indexFilePath, projectId, 'utf8');

  return projectId;
};

export const openOrCreateProject = async ({
  directoryPath,
  rendererProcessId,
  browserWindow,
  listDirectoryFiles,
  readFile,
}: {
  directoryPath: string;
  rendererProcessId: string;
  browserWindow: BrowserWindow;
  listDirectoryFiles: Filesystem['listDirectoryFiles'];
  readFile: Filesystem['readFile'];
}): Promise<VersionControlId> => {
  try {
    const projectId = await openProjectFromFilesystem({
      directoryPath,
      rendererProcessId,
      browserWindow,
      listDirectoryFiles,
      readFile,
    });

    return projectId;
  } catch {
    // Directory or index file does not exist; create a new repo & project
    // TODO: Delete .v2 directory if anything goes wrong.
    return createNewProject({
      directoryPath,
      rendererProcessId,
      browserWindow,
      listDirectoryFiles,
      readFile,
    });
  }
};
