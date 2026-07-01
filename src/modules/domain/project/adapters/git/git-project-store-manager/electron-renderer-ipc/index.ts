import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import { mapErrorTo } from '../../../../../../../utils/errors';
import { RepositoryError as VersionedProjectRepositoryError } from '../../../../errors';
import { type ProjectStoreManager } from '../../../../ports';
import { createAdapter as createProjectStoreAdapter } from '../../electron-renderer-ipc-project-store';

export const createAdapter = (): ProjectStoreManager => {
  const openOrCreateProject: ProjectStoreManager['openOrCreateProject'] =
    () =>
    ({ username, email, cloneUrl }) =>
      pipe(
        Effect.tryPromise({
          try: () =>
            window.projectStoreManagerAPI.openOrCreateProject({
              username,
              email,
              cloneUrl,
            }),
          // TODO: Leverage typed Effect errors returned from the respective node adapter
          catch: mapErrorTo(
            VersionedProjectRepositoryError,
            'Error in creating project'
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
            // It's really the main process store that manages the filesystem
            // workdir here, but from the perspective of the client using this
            // adapter it should be transparent.
            projectStore: createProjectStoreAdapter({
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

  const openProjectById: ProjectStoreManager['openProjectById'] =
    () =>
    ({ projectId, directoryPath, username, email }) =>
      pipe(
        Effect.tryPromise({
          try: () =>
            window.projectStoreManagerAPI.openProjectById({
              projectId,
              directoryPath,
              username,
              email,
            }),
          // TODO: Leverage typed Effect errors returned from the respective node adapter
          catch: mapErrorTo(
            VersionedProjectRepositoryError,
            'Error in creating project'
          ),
        }),
        Effect.map(
          ({
            directory,
            currentBranch,
            mergeConflictInfo,
            remoteProjects,
          }) => ({
            // It's really the main process store that manages the filesystem
            // workdir here, but from the perspective of the client using this
            // adapter it should be transparent.
            projectStore: createProjectStoreAdapter({
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
    openOrCreateProject,
    openProjectById,
  };
};
