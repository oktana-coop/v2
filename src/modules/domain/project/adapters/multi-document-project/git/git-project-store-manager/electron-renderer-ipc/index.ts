import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import { createAdapter as createVersionedDocumentStoreAdapter } from '../../../../../../../../modules/domain/rich-text/adapters/electron-renderer-ipc-versioned-document-store';
import { mapErrorTo } from '../../../../../../../../utils/errors';
import { RepositoryError as VersionedProjectRepositoryError } from '../../../../../errors';
import { type MultiDocumentProjectStoreManager } from '../../../../../ports';
import { createAdapter as createMultiDocumentProjectStoreAdapter } from '../../electron-renderer-ipc-project-store';

export const createAdapter = (): MultiDocumentProjectStoreManager => {
  const openOrCreateMultiDocumentProject: MultiDocumentProjectStoreManager['openOrCreateMultiDocumentProject'] =
    () => () =>
      pipe(
        Effect.tryPromise({
          try: () =>
            window.multiDocumentProjectStoreManagerAPI.openOrCreateMultiDocumentProject(),
          // TODO: Leverage typed Effect errors returned from the respective node adapter
          catch: mapErrorTo(
            VersionedProjectRepositoryError,
            'Error in creating multi-document project'
          ),
        }),
        Effect.map(({ projectId, directory }) => ({
          versionedProjectStore: createMultiDocumentProjectStoreAdapter(),
          versionedDocumentStore:
            createVersionedDocumentStoreAdapter(projectId),
          projectId,
          directory,
        }))
      );

  const openMultiDocumentProjectById: MultiDocumentProjectStoreManager['openMultiDocumentProjectById'] =

      () =>
      ({ projectId, directoryPath }) =>
        pipe(
          Effect.tryPromise({
            try: () =>
              window.multiDocumentProjectStoreManagerAPI.openMultiDocumentProjectById(
                {
                  projectId,
                  directoryPath,
                }
              ),
            // TODO: Leverage typed Effect errors returned from the respective node adapter
            catch: mapErrorTo(
              VersionedProjectRepositoryError,
              'Error in creating multi-document project'
            ),
          }),
          Effect.map(({ directory }) => ({
            versionedProjectStore: createMultiDocumentProjectStoreAdapter(),
            versionedDocumentStore:
              createVersionedDocumentStoreAdapter(projectId),
            projectId,
            directory,
          }))
        );

  return {
    openOrCreateMultiDocumentProject,
    openMultiDocumentProjectById,
  };
};
