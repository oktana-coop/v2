import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import { createAdapter as createVersionedDocumentStoreAdapter } from '../../../../../../../../modules/domain/rich-text/adapters/versioned-document-store/git/electron-renderer-ipc-versioned-document-store';
import { mapErrorTo } from '../../../../../../../../utils/errors';
import { RepositoryError as VersionedProjectRepositoryError } from '../../../../../errors';
import { type SingleDocumentProjectStoreManager } from '../../../../../ports';
import { createAdapter as createSingleDocumentProjectStoreAdapter } from '../../electron-renderer-ipc-project-store';

export const createAdapter = (): SingleDocumentProjectStoreManager => {
  const setupSingleDocumentProjectStore: SingleDocumentProjectStoreManager['setupSingleDocumentProjectStore'] =
    () => () =>
      pipe(
        Effect.tryPromise({
          try: () =>
            window.singleDocumentProjectStoreManagerAPI.setupSingleDocumentProjectStore(
              {}
            ),
          // TODO: Leverage typed Effect errors returned from the respective node adapter
          catch: mapErrorTo(
            VersionedProjectRepositoryError,
            'Error in creating single-document project'
          ),
        }),
        Effect.map(({ projectId, documentId, file, name }) => ({
          versionedProjectStore:
            createSingleDocumentProjectStoreAdapter(projectId),
          versionedDocumentStore:
            createVersionedDocumentStoreAdapter(projectId),
          projectId,
          documentId,
          file,
          name,
        }))
      );

  const openSingleDocumentProjectStore: SingleDocumentProjectStoreManager['openSingleDocumentProjectStore'] =

      () =>
      ({ fromFile, projectId }) =>
        pipe(
          Effect.tryPromise({
            try: () =>
              window.singleDocumentProjectStoreManagerAPI.openSingleDocumentProjectStore(
                {
                  fromFile,
                  projectId,
                }
              ),
            // TODO: Leverage typed Effect errors returned from the respective node adapter
            catch: mapErrorTo(
              VersionedProjectRepositoryError,
              'Error in creating single-document project'
            ),
          }),
          Effect.map(({ projectId, documentId, file, name }) => ({
            versionedProjectStore:
              createSingleDocumentProjectStoreAdapter(projectId),
            versionedDocumentStore:
              createVersionedDocumentStoreAdapter(projectId),
            projectId,
            documentId,
            file,
            name,
          }))
        );

  return {
    setupSingleDocumentProjectStore,
    openSingleDocumentProjectStore,
  };
};
