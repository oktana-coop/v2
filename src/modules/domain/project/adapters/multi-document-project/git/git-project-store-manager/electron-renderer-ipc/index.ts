import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import { createAdapter as createVersionedDocumentStoreAdapter } from '../../../../../../../../modules/domain/rich-text/adapters/versioned-document-store/git/electron-renderer-ipc-versioned-document-store';
import { mapErrorTo } from '../../../../../../../../utils/errors';
import { RepositoryError as VersionedProjectRepositoryError } from '../../../../../errors';
import { type MultiDocumentProjectStoreManager } from '../../../../../ports';
import { createAdapter as createMultiDocumentProjectStoreAdapter } from '../../electron-renderer-ipc-project-store';

export const createAdapter = (): MultiDocumentProjectStoreManager => {
  const openOrCreateMultiDocumentProject: MultiDocumentProjectStoreManager['openOrCreateMultiDocumentProject'] =

      () =>
      ({ username, email, cloneUrl }) =>
        pipe(
          Effect.tryPromise({
            try: () =>
              window.multiDocumentProjectStoreManagerAPI.openOrCreateMultiDocumentProject(
                { username, email, cloneUrl }
              ),
            // TODO: Leverage typed Effect errors returned from the respective node adapter
            catch: mapErrorTo(
              VersionedProjectRepositoryError,
              'Error in creating multi-document project'
            ),
          }),
          Effect.map(
            ({
              projectId,
              directory,
              currentBranch,
              mergeConflictInfo,
              remoteProjects,
            }) => ({
              versionedProjectStore: createMultiDocumentProjectStoreAdapter(),
              versionedDocumentStore: createVersionedDocumentStoreAdapter({
                projectId,
                // It's really the main process store that manages the filesystem workdir here,
                // but from the perspective of the client using this adapter it should be transparent.
                managesFilesystemWorkdir: true,
              }),
              projectId,
              directory,
              currentBranch,
              mergeConflictInfo,
              remoteProjects,
            })
          )
        );

  const openMultiDocumentProjectById: MultiDocumentProjectStoreManager['openMultiDocumentProjectById'] =

      () =>
      ({ projectId, directoryPath, username, email }) =>
        pipe(
          Effect.tryPromise({
            try: () =>
              window.multiDocumentProjectStoreManagerAPI.openMultiDocumentProjectById(
                {
                  projectId,
                  directoryPath,
                  username,
                  email,
                }
              ),
            // TODO: Leverage typed Effect errors returned from the respective node adapter
            catch: mapErrorTo(
              VersionedProjectRepositoryError,
              'Error in creating multi-document project'
            ),
          }),
          Effect.map(
            ({
              directory,
              currentBranch,
              mergeConflictInfo,
              remoteProjects,
            }) => ({
              versionedProjectStore: createMultiDocumentProjectStoreAdapter(),
              // It's really the main process store that manages the filesystem workdir here,
              // but from the perspective of the client using this adapter it should be transparent.
              versionedDocumentStore: createVersionedDocumentStoreAdapter({
                projectId,
                managesFilesystemWorkdir: true,
              }),
              projectId,
              directory,
              currentBranch,
              mergeConflictInfo,
              remoteProjects,
            })
          )
        );

  return {
    openOrCreateMultiDocumentProject,
    openMultiDocumentProjectById,
  };
};
