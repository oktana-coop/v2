import fs from 'node:fs';

import * as Effect from 'effect/Effect';

import { createAdapter as createVersionedDocumentStoreAdapter } from '../../../../../../../../modules/domain/rich-text/adapters/git-versioned-document-store';
import { type MultiDocumentProjectStoreManager } from '../../../../../ports';
import { createAdapter as createMultiDocumentProjectStoreAdapter } from '../../git-project-store';

export const createAdapter = (): MultiDocumentProjectStoreManager => {
  const openOrCreateMultiDocumentProject: MultiDocumentProjectStoreManager['openOrCreateMultiDocumentProject'] =

      ({ filesystem }) =>
      () =>
        Effect.Do.pipe(
          Effect.bind('directory', () => filesystem.openDirectory()),
          Effect.bind('versionedProjectStore', () =>
            Effect.succeed(
              createMultiDocumentProjectStoreAdapter({
                isoGitFs: fs,
                filesystem,
              })
            )
          ),
          Effect.bind('projectId', ({ directory, versionedProjectStore }) =>
            versionedProjectStore.createProject({ path: directory.path })
          ),
          Effect.map(({ directory, versionedProjectStore, projectId }) => ({
            versionedProjectStore,
            versionedDocumentStore: createVersionedDocumentStoreAdapter({
              isoGitFs: fs,
              filesystem,
              projectId,
            }),
            projectId,
            directory,
          }))
        );

  const openMultiDocumentProjectById: MultiDocumentProjectStoreManager['openMultiDocumentProjectById'] =

      ({ filesystem }) =>
      ({ projectId, directoryPath }) =>
        Effect.Do.pipe(
          Effect.bind('directory', () =>
            filesystem.getDirectory(directoryPath)
          ),
          Effect.bind('versionedProjectStore', () =>
            Effect.succeed(
              createMultiDocumentProjectStoreAdapter({
                isoGitFs: fs,
                filesystem,
              })
            )
          ),
          Effect.map(({ directory, versionedProjectStore }) => ({
            versionedProjectStore,
            versionedDocumentStore: createVersionedDocumentStoreAdapter({
              isoGitFs: fs,
              filesystem,
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
