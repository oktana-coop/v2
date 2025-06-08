import { type Repo } from '@automerge/automerge-repo/slim';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import { createAdapter as createAutomergeDocumentStoreAdapter } from '../../../../../../../modules/domain/rich-text/adapters/automerge-versioned-document-store';
import { setupForWeb as setupBrowserRepoForWeb } from '../../../../../../../modules/infrastructure/version-control/automerge-repo/browser';
import { mapErrorTo } from '../../../../../../../utils/errors';
import { RepositoryError as VersionedProjectRepositoryError } from '../../../../errors';
import { type SingleDocumentProjectStoreManager } from '../../../../ports';
import { createAdapter as createAutomergeProjectStoreAdapter } from '../../automerge-project-store';

const setupAutomergeRepo = (): Effect.Effect<
  Repo,
  VersionedProjectRepositoryError,
  never
> =>
  Effect.tryPromise({
    // TODO: Consider an SQLite version that works in the browser using WASM.
    // Also, clear the database before re-creating it.
    try: () => setupBrowserRepoForWeb(),
    catch: mapErrorTo(
      VersionedProjectRepositoryError,
      'Error in setting up Automerge repo'
    ),
  });

export const createAdapter = (): SingleDocumentProjectStoreManager => {
  const setupSingleDocumentProjectStore: SingleDocumentProjectStoreManager['setupSingleDocumentProjectStore'] =
    () => () =>
      pipe(
        // TODO: If we want to write to a file, we probably need SQLite in the browser + file export
        setupAutomergeRepo(),
        Effect.map((automergeRepo) => ({
          versionedProjectStore:
            createAutomergeProjectStoreAdapter(automergeRepo),
          versionedDocumentStore:
            createAutomergeDocumentStoreAdapter(automergeRepo),
        }))
      );

  return {
    setupSingleDocumentProjectStore,
  };
};
