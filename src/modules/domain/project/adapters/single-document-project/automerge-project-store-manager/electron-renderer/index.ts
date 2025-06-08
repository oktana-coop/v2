import { type Repo } from '@automerge/automerge-repo/slim';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import { createAdapter as createAutomergeDocumentStoreAdapter } from '../../../../../../../modules/domain/rich-text/adapters/automerge-versioned-document-store';
import { setupForElectron as setupBrowserRepoForElectron } from '../../../../../../../modules/infrastructure/version-control/automerge-repo/browser';
import { mapErrorTo } from '../../../../../../../utils/errors';
import { RepositoryError as VersionedProjectRepositoryError } from '../../../../errors';
import { type SingleDocumentProjectStoreManager } from '../../../../ports';
import { createAdapter as createAutomergeProjectStoreAdapter } from '../../automerge-project-store';

export type ElectronDeps = {
  processId: string;
};

const setupAutomergeRepo = ({
  processId,
}: ElectronDeps): Effect.Effect<Repo, VersionedProjectRepositoryError, never> =>
  Effect.tryPromise({
    try: () => setupBrowserRepoForElectron(processId),
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
        setupAutomergeRepo({ processId }),
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
