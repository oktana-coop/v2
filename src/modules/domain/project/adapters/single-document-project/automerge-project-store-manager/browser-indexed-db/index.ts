import { type Repo } from '@automerge/automerge-repo/slim';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import { v4 as uuidv4 } from 'uuid';

import { createAdapter as createAutomergeDocumentStoreAdapter } from '../../../../../../../modules/domain/rich-text/adapters/automerge-versioned-document-store';
import { setupForWeb as setupBrowserRepoForWeb } from '../../../../../../../modules/infrastructure/version-control/automerge-repo/browser';
import { fromNullable } from '../../../../../../../utils/effect';
import { mapErrorTo } from '../../../../../../../utils/errors';
import { createDocumentAndProject } from '../../../../commands/single-document-project';
import { getProjectName } from '../../../../commands/single-document-project';
import {
  RepositoryError as VersionedProjectRepositoryError,
  ValidationError as VersionedProjectValidationError,
} from '../../../../errors';
import { type SingleDocumentProjectStoreManager } from '../../../../ports';
import { createAdapter as createAutomergeProjectStoreAdapter } from '../../automerge-project-store';
import { clone, openDB } from './db';

const STORE_NAME = 'documents';

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

const copyDataFromSourceToTargetDB = ({
  sourceDBName,
  targetDBName,
  store,
}: {
  sourceDBName: string;
  targetDBName: string;
  store: string;
}): Effect.Effect<void, VersionedProjectRepositoryError, never> =>
  Effect.Do.pipe(
    Effect.bind('sourceDB', () =>
      Effect.tryPromise({
        try: () => openDB({ dbName: sourceDBName, storeName: store }),
        catch: mapErrorTo(
          VersionedProjectRepositoryError,
          'Could not open temp IndexedDB'
        ),
      })
    ),
    Effect.bind('targetDB', () =>
      Effect.tryPromise({
        try: () => openDB({ dbName: targetDBName, storeName: store }),
        catch: mapErrorTo(
          VersionedProjectRepositoryError,
          'Could not open target IndexedDB'
        ),
      })
    ),
    Effect.flatMap(({ sourceDB, targetDB }) =>
      Effect.tryPromise({
        try: () => clone({ sourceDB, targetDB, storeName: store }),
        catch: mapErrorTo(
          VersionedProjectRepositoryError,
          'Could not clone data from temp to target IndexedDB'
        ),
      })
    )
  );

export const createAdapter = (): SingleDocumentProjectStoreManager => {
  const setupSingleDocumentProjectStore: SingleDocumentProjectStoreManager['setupSingleDocumentProjectStore'] =

      () =>
      ({ name }) =>
        Effect.Do.pipe(
          Effect.bind('projectName', () =>
            fromNullable(
              name,
              () =>
                new VersionedProjectValidationError('Project name is mandatory')
            )
          ),
          Effect.bind('tempDBName', () =>
            Effect.succeed(`temp-automerge-${uuidv4()}`)
          ),
          Effect.bind('tempAutomergeRepo', ({ tempDBName }) =>
            setupAutomergeRepo({
              dbName: tempDBName,
              store: STORE_NAME,
            })
          ),
          Effect.bind(
            'projectAndDocumentData',
            ({ tempAutomergeRepo, projectName }) =>
              pipe(
                Effect.succeed({
                  tempVersionedProjectStore:
                    createAutomergeProjectStoreAdapter(tempAutomergeRepo),
                  tempVersionedDocumentStore:
                    createAutomergeDocumentStoreAdapter(tempAutomergeRepo),
                }),
                Effect.flatMap(
                  ({ tempVersionedProjectStore, tempVersionedDocumentStore }) =>
                    pipe(
                      createDocumentAndProject({
                        createDocument:
                          tempVersionedDocumentStore.createDocument,
                        createSingleDocumentProject:
                          tempVersionedProjectStore.createSingleDocumentProject,
                      })({
                        name: projectName,
                        content: null,
                      }),
                      Effect.map(({ documentId, projectId }) => ({
                        projectId,
                        documentId,
                      }))
                    )
                )
              )
          ),
          Effect.bind('dbName', ({ tempDBName, projectAndDocumentData }) =>
            pipe(
              // The name of the target (persistent) DB is the project ID.
              Effect.succeed(projectAndDocumentData.projectId),
              // TODO: Fix this race condition. It seems that some time must pass before the
              // automerge documents for project and document written into IndexedDB.
              Effect.tap(() => Effect.sleep('500 millis')),
              Effect.tap((targetDBName) =>
                copyDataFromSourceToTargetDB({
                  sourceDBName: tempDBName,
                  targetDBName,
                  store: STORE_NAME,
                })
              )
            )
          ),
          Effect.bind('automergeRepo', ({ dbName }) =>
            setupAutomergeRepo({
              dbName,
              store: STORE_NAME,
            })
          ),
          Effect.bind('versionedProjectStore', ({ automergeRepo }) =>
            Effect.succeed(createAutomergeProjectStoreAdapter(automergeRepo))
          ),
          Effect.bind(
            'versionedDocumentStore',
            ({ automergeRepo, projectAndDocumentData }) =>
              Effect.succeed(
                createAutomergeDocumentStoreAdapter(
                  automergeRepo,
                  projectAndDocumentData.projectId
                )
              )
          ),
          Effect.map(
            ({
              versionedProjectStore,
              versionedDocumentStore,
              projectAndDocumentData,
              projectName,
            }) => ({
              versionedProjectStore,
              versionedDocumentStore,
              projectId: projectAndDocumentData.projectId,
              documentId: projectAndDocumentData.documentId,
              file: null,
              name: projectName,
            })
          )
        );

  const openSingleDocumentProjectStore: SingleDocumentProjectStoreManager['openSingleDocumentProjectStore'] =

      () =>
      ({ projectId: projectIdInput }) =>
        pipe(
          fromNullable(
            projectIdInput,
            () =>
              new VersionedProjectValidationError(
                'Project ID is mandatory to open a project in the browser'
              )
          ),
          Effect.flatMap((projectId) =>
            pipe(
              setupAutomergeRepo({
                dbName: projectId,
                store: STORE_NAME,
              }),
              Effect.map((automergeRepo) => ({
                versionedProjectStore:
                  createAutomergeProjectStoreAdapter(automergeRepo),
                versionedDocumentStore: createAutomergeDocumentStoreAdapter(
                  automergeRepo,
                  projectId
                ),
              })),
              Effect.flatMap(
                ({ versionedProjectStore, versionedDocumentStore }) =>
                  Effect.Do.pipe(
                    Effect.bind('documentId', () =>
                      versionedProjectStore.findDocumentInProject(projectId)
                    ),
                    Effect.bind('projectName', () =>
                      getProjectName({
                        getProjectNameFromStore:
                          versionedProjectStore.getProjectName,
                      })({ projectId })
                    ),
                    Effect.map(({ documentId, projectName }) => ({
                      versionedProjectStore,
                      versionedDocumentStore,
                      projectId,
                      documentId,
                      file: null,
                      name: projectName,
                    }))
                  )
              )
            )
          )
        );

  return {
    setupSingleDocumentProjectStore,
    openSingleDocumentProjectStore,
  };
};
