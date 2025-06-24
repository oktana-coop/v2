import { type Repo } from '@automerge/automerge-repo/slim';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import { createAdapter as createAutomergeDocumentStoreAdapter } from '../../../../../../../modules/domain/rich-text/adapters/automerge-versioned-document-store';
import { setupForElectron as setupBrowserRepoForElectron } from '../../../../../../../modules/infrastructure/version-control/automerge-repo/browser';
import { mapErrorTo } from '../../../../../../../utils/errors';
import { RepositoryError as VersionedProjectRepositoryError } from '../../../../errors';
import {
  type OpenSingleDocumentProjectStoreArgs,
  type SingleDocumentProjectStoreManager,
} from '../../../../ports';
import { createAdapter as createAutomergeProjectStoreAdapter } from '../../automerge-project-store';

export type ElectronDeps = {
  processId: string;
};

const STORE_NAME = 'documents';

const setupAutomergeRepo = ({
  processId,
  dbName,
  store,
}: ElectronDeps & {
  dbName: string;
  store: string;
}): Effect.Effect<Repo, VersionedProjectRepositoryError, never> =>
  Effect.tryPromise({
    try: () =>
      setupBrowserRepoForElectron({
        processId,
        dbName,
        store,
        initiateSync: true,
      }),
    catch: mapErrorTo(
      VersionedProjectRepositoryError,
      'Error in setting up Automerge repo'
    ),
  });

export const createAdapter = ({
  processId,
}: ElectronDeps): SingleDocumentProjectStoreManager => {
  const setupSingleDocumentProjectStore: SingleDocumentProjectStoreManager['setupSingleDocumentProjectStore'] =
    () => () =>
      pipe(
        Effect.tryPromise({
          try: () =>
            window.singleDocumentProjectAPI.createSingleDocumentProject({}),
          // TODO: Leverage typed Effect errors returned from the respective node adapter
          catch: mapErrorTo(
            VersionedProjectRepositoryError,
            'Error in creating single-document project'
          ),
        }),
        Effect.flatMap(({ projectId, documentId, file, name }) =>
          pipe(
            // TODO: Consider a cleaner approach of wiping IndexedDB (or the previous project's DB)
            // before setting up the new one. For now, assuming that we don't want to do this so that performance
            // is better as the user switches between known projects, and IndexedDB is guaranteed to be wiped when
            // they close the app.
            setupAutomergeRepo({
              processId,
              dbName: projectId,
              store: STORE_NAME,
            }),
            Effect.map((automergeRepo) => ({
              versionedProjectStore:
                createAutomergeProjectStoreAdapter(automergeRepo),
              versionedDocumentStore:
                createAutomergeDocumentStoreAdapter(automergeRepo),
              projectId,
              documentId,
              file,
              name,
            }))
          )
        )
      );

  const openSingleDocumentProjectStore: SingleDocumentProjectStoreManager['openSingleDocumentProjectStore'] =

      () =>
      ({ fromFile }: OpenSingleDocumentProjectStoreArgs) =>
        pipe(
          Effect.tryPromise({
            try: () =>
              window.singleDocumentProjectAPI.openSingleDocumentProject({
                fromFile,
              }),
            // TODO: Leverage typed Effect errors returned from the respective node adapter
            catch: mapErrorTo(
              VersionedProjectRepositoryError,
              'Error in opening single-document project'
            ),
          }),
          Effect.flatMap(({ projectId, documentId, file, name }) =>
            pipe(
              // TODO: Consider a cleaner approach of wiping IndexedDB (or the previous project's DB)
              // before setting up the new one. For now, assuming that we don't want to do this so that performance
              // is better as the user switches between known projects, and IndexedDB is guaranteed to be wiped when
              // they close the app.
              setupAutomergeRepo({
                processId,
                dbName: projectId,
                store: STORE_NAME,
              }),
              Effect.map((automergeRepo) => ({
                versionedProjectStore:
                  createAutomergeProjectStoreAdapter(automergeRepo),
                versionedDocumentStore:
                  createAutomergeDocumentStoreAdapter(automergeRepo),
                projectId,
                documentId,
                file,
                name,
              }))
            )
          )
        );

  return {
    setupSingleDocumentProjectStore,
    openSingleDocumentProjectStore,
  };
};
