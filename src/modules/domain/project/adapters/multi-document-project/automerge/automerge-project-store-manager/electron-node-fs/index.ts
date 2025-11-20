import { promises as fs } from 'node:fs';
import { join } from 'node:path';

import { type Repo } from '@automerge/automerge-repo/slim';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import { BrowserWindow } from 'electron';

import {
  NotFoundError as VersionedDocumentNotFoundError,
  RepositoryError as VersionedDocumentRepositoryError,
  ValidationError as VersionedDocumentValidationError,
  VersionedDocumentStore,
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
import { setupFilesystemRepoForNode } from '../../../../../../../../modules/infrastructure/version-control/automerge-repo/node';
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
  MultiDocumentProjectStore,
  type MultiDocumentProjectStoreManager,
} from '../../../../../ports';
import { createAdapter as createAutomergeProjectStoreAdapter } from '../../automerge-project-store';

export type ElectronDeps = {
  rendererProcessId: string;
  browserWindow: BrowserWindow;
};

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
      setupFilesystemRepoForNode({
        directoryPath: join(directoryPath, '.v2', 'automerge'),
        renderers: new Map([[rendererProcessId, browserWindow]]),
        initiateSync: false,
      }),
    catch: mapErrorTo(
      VersionedProjectRepositoryError,
      'Error in setting up Automerge repo'
    ),
  });

type OpenProjectResult = {
  versionedProjectStore: MultiDocumentProjectStore;
  versionedDocumentStore: VersionedDocumentStore;
};

const openProject = ({
  projectId,
  directoryPath,
  rendererProcessId,
  browserWindow,
  filesystem,
}: {
  projectId: ProjectId;
  directoryPath: string;
  rendererProcessId: string;
  browserWindow: BrowserWindow;
  filesystem: Filesystem;
}): Effect.Effect<
  OpenProjectResult,
  | FilesystemAccessControlError
  | FilesystemDataIntegrityError
  | FilesystemNotFoundError
  | FilesystemRepositoryError
  | VersionedProjectRepositoryError
  | VersionedProjectNotFoundError
  | VersionedProjectValidationError
  | VersionedDocumentRepositoryError
  | VersionedDocumentNotFoundError
  | VersionedDocumentValidationError
  | MigrationError,
  never
> =>
  pipe(
    setupAutomergeRepo({
      directoryPath,
      rendererProcessId,
      browserWindow,
    }),
    Effect.map((automergeRepo) => ({
      versionedProjectStore: createAutomergeProjectStoreAdapter(automergeRepo),
      versionedDocumentStore: createAutomergeDocumentStoreAdapter({
        automergeRepo,
        projectId,
        filesystem,
        managesFilesystemWorkdir: true,
      }),
    })),
    Effect.tap(({ versionedProjectStore, versionedDocumentStore }) =>
      updateProjectFromFilesystemContent({
        findDocumentById: versionedDocumentStore.findDocumentById,
        createDocument: versionedDocumentStore.createDocument,
        deleteDocument: versionedDocumentStore.deleteDocument,
        updateRichTextDocumentContent:
          versionedDocumentStore.updateRichTextDocumentContent,
        listProjectDocuments: versionedProjectStore.listProjectDocuments,
        findDocumentInProject: versionedProjectStore.findDocumentInProject,
        deleteDocumentFromProject:
          versionedProjectStore.deleteDocumentFromProject,
        addDocumentToProject: versionedProjectStore.addDocumentToProject,
        listDirectoryFiles: filesystem.listDirectoryFiles,
        readFile: filesystem.readFile,
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
  ProjectId,
  | FilesystemAccessControlError
  | FilesystemRepositoryError
  | VersionedProjectMissingProjectMetadataError
  | VersionedProjectDataIntegrityError,
  never
> => {
  const indexFilePath = join(directoryPath, '.v2', 'index.txt');

  return pipe(
    readFile(indexFilePath),
    Effect.catchTag('FilesystemNotFoundError', () =>
      Effect.fail(
        new VersionedProjectMissingProjectMetadataError(
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
      Effect.try({
        try: () => {
          if (typeof projectId !== 'string') {
            throw new Error('Expected a string project id');
          }

          return parseAutomergeUrl(projectId);
        },
        catch: mapErrorTo(
          VersionedProjectDataIntegrityError,
          'Project ID found in index file is invalid Automerge URL'
        ),
      })
    )
  );
};

type OpenOrCreateProjectFromFilesystemResult = {
  projectId: ProjectId;
  versionedProjectStore: MultiDocumentProjectStore;
  versionedDocumentStore: VersionedDocumentStore;
};

const openProjectFromFilesystem = ({
  directoryPath,
  rendererProcessId,
  browserWindow,
  filesystem,
}: {
  directoryPath: string;
  rendererProcessId: string;
  browserWindow: BrowserWindow;
  filesystem: Filesystem;
}): Effect.Effect<
  OpenOrCreateProjectFromFilesystemResult,
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
    filesystem.assertWritePermissionForDirectory(directoryPath),
    Effect.flatMap(() =>
      readProjectIdFromDirIndexFile({
        directoryPath,
        readFile: filesystem.readFile,
      })
    ),
    Effect.flatMap((projectId) =>
      pipe(
        openProject({
          projectId,
          directoryPath,
          rendererProcessId,
          browserWindow,
          filesystem,
        }),
        Effect.map(({ versionedProjectStore, versionedDocumentStore }) => ({
          projectId,
          versionedProjectStore,
          versionedDocumentStore,
        }))
      )
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
  projectId: ProjectId;
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
  filesystem,
}: {
  directoryPath: string;
  rendererProcessId: string;
  browserWindow: BrowserWindow;
  filesystem: Filesystem;
}): Effect.Effect<
  OpenOrCreateProjectFromFilesystemResult,
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
    Effect.flatMap((automergeRepo) =>
      Effect.Do.pipe(
        Effect.bind('versionedProjectStore', () =>
          Effect.succeed(createAutomergeProjectStoreAdapter(automergeRepo))
        ),
        Effect.bind('versionedDocumentStore', () =>
          Effect.succeed(
            createAutomergeDocumentStoreAdapter({
              automergeRepo,
              filesystem,
              managesFilesystemWorkdir: true,
            })
          )
        ),
        Effect.bind(
          'projectId',
          ({ versionedProjectStore, versionedDocumentStore }) =>
            createProjectFromFilesystemContent({
              createDocument: versionedDocumentStore.createDocument,
              createProject: versionedProjectStore.createProject,
              addDocumentToProject: versionedProjectStore.addDocumentToProject,
              listDirectoryFiles: filesystem.listDirectoryFiles,
              readFile: filesystem.readFile,
            })({ directoryPath })
        ),
        Effect.tap(({ projectId }) =>
          writeIndexFile({
            rootDirectoryPath: directoryPath,
            projectId,
            writeFile: filesystem.writeFile,
          })
        ),
        Effect.tap(({ versionedDocumentStore, projectId }) =>
          versionedDocumentStore.setProjectId(projectId)
        )
      )
    )
  );

export const createAdapter = ({
  rendererProcessId,
  browserWindow,
}: ElectronDeps): MultiDocumentProjectStoreManager => {
  const openOrCreateMultiDocumentProject: MultiDocumentProjectStoreManager['openOrCreateMultiDocumentProject'] =

      ({ filesystem }) =>
      () =>
        pipe(
          filesystem.openDirectory(),
          Effect.flatMap((directory) =>
            pipe(
              pipe(
                openProjectFromFilesystem({
                  directoryPath: directory.path,
                  rendererProcessId,
                  browserWindow,
                  filesystem,
                }),
                Effect.catchIf(
                  (error) =>
                    error instanceof FilesystemNotFoundError ||
                    error instanceof FilesystemAccessControlError ||
                    error instanceof
                      VersionedProjectMissingProjectMetadataError,
                  // Directory does not exist or can't be accessed.
                  // Create a new repo & project
                  () =>
                    createNewProject({
                      directoryPath: directory.path,
                      rendererProcessId,
                      browserWindow,
                      filesystem,
                    })
                )
              ),
              Effect.map(
                ({
                  projectId,
                  versionedProjectStore,
                  versionedDocumentStore,
                }) => ({
                  versionedProjectStore,
                  versionedDocumentStore,
                  projectId,
                  directory,
                })
              )
            )
          )
        );

  const openMultiDocumentProjectById: MultiDocumentProjectStoreManager['openMultiDocumentProjectById'] =

      ({ filesystem }) =>
      ({ projectId, directoryPath }) =>
        pipe(
          filesystem.getDirectory(directoryPath),
          Effect.flatMap((directory) =>
            pipe(
              readProjectIdFromDirIndexFile({
                directoryPath,
                readFile: filesystem.readFile,
              }),
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
                  filesystem,
                })
              ),
              Effect.map(
                ({ versionedProjectStore, versionedDocumentStore }) => ({
                  versionedProjectStore,
                  versionedDocumentStore,
                  projectId,
                  directory,
                })
              )
            )
          )
        );

  return {
    openOrCreateMultiDocumentProject,
    openMultiDocumentProjectById,
  };
};
