import fs from 'node:fs';

import * as Effect from 'effect/Effect';

import { createAdapter as createVersionedDocumentStoreAdapter } from '../../../../../../../modules/domain/rich-text/adapters/git-versioned-document-store';
import { type MultiDocumentProjectStoreManager } from '../../../../ports';
import { createAdapter as createMultiDocumentProjectStoreAdapter } from '../../git-project-store';

export const createAdapter = (): MultiDocumentProjectStoreManager => {
  const openOrCreateMultiDocumentProject: MultiDocumentProjectStoreManager['openOrCreateMultiDocumentProject'] =

      ({ openDirectory }) =>
      () =>
        Effect.Do.pipe(
          Effect.bind('directory', () => openDirectory()),
          Effect.bind('versionedProjectStore', () =>
            Effect.succeed(createMultiDocumentProjectStoreAdapter({ fs }))
          ),
          Effect.bind('projectId', ({ directory, versionedProjectStore }) =>
            versionedProjectStore.createProject({ path: directory.path })
          ),
          Effect.map(({ directory, versionedProjectStore, projectId }) => ({
            versionedProjectStore,
            versionedDocumentStore: createVersionedDocumentStoreAdapter({
              fs,
              projectId,
            }),
            projectId,
            directory,
          }))
        );

  const openMultiDocumentProjectById: MultiDocumentProjectStoreManager['openMultiDocumentProjectById'] =

      ({ getDirectory }) =>
      ({ projectId, directoryPath }) =>
        Effect.Do.pipe(
          Effect.bind('directory', () => getDirectory(directoryPath)),
          Effect.bind('versionedProjectStore', () =>
            Effect.succeed(createMultiDocumentProjectStoreAdapter({ fs }))
          ),
          Effect.map(({ directory, versionedProjectStore }) => ({
            versionedProjectStore,
            versionedDocumentStore: createVersionedDocumentStoreAdapter({
              fs,
              projectId,
            }),
            projectId,
            directory,
          }))
        );

  return {
    openOrCreateMultiDocumentProject,
    openMultiDocumentProjectById,
  };
};
