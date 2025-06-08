import { type Repo } from '@automerge/automerge-repo/slim';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import { BrowserWindow } from 'electron';

import { setupSQLiteRepoForNode } from '../../../../../../../modules/infrastructure/version-control/automerge-repo/node';
import { mapErrorTo } from '../../../../../../../utils/errors';
import { RepositoryError as VersionedProjectRepositoryError } from '../../../../errors';
import {
  type SetupSingleDocumentProjectStoreArgs,
  type SetupSingleDocumentProjectStoreDeps,
  type SingleDocumentProjectStoreManager,
} from '../../../../ports';

const setupAutomergeRepo = ({
  filePath,
  rendererProcessId,
  browserWindow,
}: {
  filePath: string;
  rendererProcessId: string;
  browserWindow: BrowserWindow;
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

export type ElectronDeps = {
  rendererProcessId: string;
  browserWindow: BrowserWindow;
};

export const createAdapter = ({
  rendererProcessId,
  browserWindow,
}: ElectronDeps): SingleDocumentProjectStoreManager => {
  const setupSingleDocumentProjectStore: SingleDocumentProjectStoreManager['setupSingleDocumentProjectStore'] =

      ({ createNewFile }: SetupSingleDocumentProjectStoreDeps) =>
      ({ suggestedName }: SetupSingleDocumentProjectStoreArgs) =>
        pipe(
          createNewFile(suggestedName),
          Effect.flatMap((newFile) =>
            setupAutomergeRepo({
              filePath: newFile.path!,
              rendererProcessId,
              browserWindow,
            })
          ),
          Effect.as(undefined)
        );

  return {
    setupSingleDocumentProjectStore,
  };
};
