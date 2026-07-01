import fs from 'node:fs';

import * as Effect from 'effect/Effect';
import http from 'isomorphic-git/http/node';

import { type DocumentAnalyzer } from '../../../../../../../modules/domain/rich-text';
import { DEFAULT_ASSETS_DIR_NAME } from '../../../../constants';
import { type ProjectStoreManager } from '../../../../ports';
import { createAdapter as createProjectStoreAdapter } from '../../git-project-store';

export const createAdapter = ({
  documentAnalyzer,
  assetsDirName = DEFAULT_ASSETS_DIR_NAME,
}: {
  documentAnalyzer: DocumentAnalyzer;
  assetsDirName?: string;
}): ProjectStoreManager => {
  const openOrCreateProject: ProjectStoreManager['openOrCreateProject'] =
    ({ filesystem }) =>
    ({ username, email, cloneUrl, authToken }) =>
      Effect.Do.pipe(
        Effect.bind('directory', () => filesystem.openDirectory()),
        Effect.bind('projectStore', () =>
          Effect.succeed(
            createProjectStoreAdapter({
              isoGitFs: fs,
              isoGitHttp: http,
              filesystem,
              documentAnalyzer,
              managesFilesystemWorkdir: true,
              assetsDirName,
            })
          )
        ),
        Effect.bind('projectId', ({ directory, projectStore }) =>
          projectStore.createProject({
            path: directory.path,
            cloneUrl,
            authToken,
            username,
            email,
          })
        ),
        Effect.bind('currentBranch', ({ projectStore, projectId }) =>
          projectStore.getCurrentBranch({ projectId })
        ),
        Effect.bind('mergeConflictInfo', ({ projectStore, projectId }) =>
          projectStore.getMergeConflictInfo({ projectId })
        ),
        Effect.bind('remoteProjects', ({ projectStore, projectId }) =>
          projectStore.listRemoteProjects({ projectId })
        ),
        Effect.map(
          ({
            directory,
            projectStore,
            projectId,
            currentBranch,
            mergeConflictInfo,
            remoteProjects,
          }) => ({
            projectStore,
            projectId,
            directory,
            currentBranch,
            mergeConflictInfo,
            remoteProjects,
          })
        )
      );

  const openProjectById: ProjectStoreManager['openProjectById'] =
    ({ filesystem }) =>
    ({ projectId, directoryPath, username, email }) =>
      Effect.Do.pipe(
        Effect.bind('directory', () => filesystem.getDirectory(directoryPath)),
        Effect.bind('projectStore', () =>
          Effect.succeed(
            createProjectStoreAdapter({
              isoGitFs: fs,
              isoGitHttp: http,
              filesystem,
              documentAnalyzer,
              managesFilesystemWorkdir: true,
              assetsDirName,
            })
          )
        ),
        Effect.tap(({ projectStore }) =>
          projectStore.setAuthorInfo({
            projectId,
            username,
            email,
          })
        ),
        Effect.bind('currentBranch', ({ projectStore }) =>
          projectStore.getCurrentBranch({ projectId })
        ),
        Effect.bind('mergeConflictInfo', ({ projectStore }) =>
          projectStore.getMergeConflictInfo({ projectId })
        ),
        Effect.bind('remoteProjects', ({ projectStore }) =>
          projectStore.listRemoteProjects({ projectId })
        ),
        Effect.map(
          ({
            directory,
            projectStore,
            currentBranch,
            mergeConflictInfo,
            remoteProjects,
          }) => ({
            projectStore,
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
