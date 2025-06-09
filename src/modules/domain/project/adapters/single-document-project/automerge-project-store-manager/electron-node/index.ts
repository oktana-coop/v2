import { type Repo } from '@automerge/automerge-repo/slim';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import { BrowserWindow } from 'electron';

import { createAdapter as createAutomergeDocumentStoreAdapter } from '../../../../../../../modules/domain/rich-text/adapters/automerge-versioned-document-store';
import { setupSQLiteRepoForNode } from '../../../../../../../modules/infrastructure/version-control/automerge-repo/node';
import { mapErrorTo } from '../../../../../../../utils/errors';
import { RepositoryError as VersionedProjectRepositoryError } from '../../../../errors';
import {
  type SetupSingleDocumentProjectStoreArgs,
  type SetupSingleDocumentProjectStoreDeps,
  type SingleDocumentProjectStoreManager,
} from '../../../../ports';
import { createAdapter as createAutomergeProjectStoreAdapter } from '../../automerge-project-store';

export type ElectronDeps = {
  rendererProcessId: string;
  browserWindow: BrowserWindow;
};

const setupAutomergeRepo = ({
  filePath,
  rendererProcessId,
  browserWindow,
}: ElectronDeps & {
  filePath: string;
}): Effect.Effect<Repo, VersionedProjectRepositoryError, never> =>
  Effect.tryPromise({
    try: () =>
      setupSQLiteRepoForNode({
        processId: 'main',
        filePath,
        renderers: new Map([[rendererProcessId, browserWindow]]),
      }),
    catch: mapErrorTo(
      VersionedProjectRepositoryError,
      'Error in setting up Automerge repo'
    ),
  });

export const createAdapter = ({
  rendererProcessId,
  browserWindow,
}: ElectronDeps): SingleDocumentProjectStoreManager => {
  const setupSingleDocumentProjectStore: SingleDocumentProjectStoreManager['setupSingleDocumentProjectStore'] =

      ({ createNewFile }: SetupSingleDocumentProjectStoreDeps) =>
      ({ suggestedName }: SetupSingleDocumentProjectStoreArgs) =>
        Effect.Do.pipe(
          Effect.bind('newFile', () => createNewFile(suggestedName)),
          Effect.bind('automergeRepo', ({ newFile }) =>
            setupAutomergeRepo({
              filePath: newFile.path!,
              rendererProcessId,
              browserWindow,
            })
          ),
          Effect.map(({ automergeRepo, newFile }) => ({
            versionedProjectStore:
              createAutomergeProjectStoreAdapter(automergeRepo),
            versionedDocumentStore:
              createAutomergeDocumentStoreAdapter(automergeRepo),
            filePath: newFile.path!,
          }))
        );

  const openSingleDocumentProjectStore: SingleDocumentProjectStoreManager['openSingleDocumentProjectStore'] =
    ({ filePath }) =>
      pipe(
        setupAutomergeRepo({
          filePath: filePath,
          rendererProcessId,
          browserWindow,
        }),
        Effect.map((automergeRepo) => ({
          versionedProjectStore:
            createAutomergeProjectStoreAdapter(automergeRepo),
          versionedDocumentStore:
            createAutomergeDocumentStoreAdapter(automergeRepo),
        }))
      );

  return {
    setupSingleDocumentProjectStore,
    openSingleDocumentProjectStore,
  };
};
