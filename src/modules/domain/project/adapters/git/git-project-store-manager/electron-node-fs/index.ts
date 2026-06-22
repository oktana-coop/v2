import fs from 'node:fs';

import * as Effect from 'effect/Effect';
import http from 'isomorphic-git/http/node';

import { type DocumentAnalyzer } from '../../../../../../../modules/domain/rich-text';
import { createAdapter as createVersionedDocumentStoreAdapter } from '../../../../../../../modules/domain/rich-text/adapters/versioned-document-store/git/git-versioned-document-store';
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
        Effect.bind('versionedProjectStore', () =>
          Effect.succeed(
            createProjectStoreAdapter({
              isoGitFs: fs,
              isoGitHttp: http,
              filesystem,
              documentAnalyzer,
              assetsDirName,
            })
          )
        ),
        Effect.bind('projectId', ({ directory, versionedProjectStore }) =>
          versionedProjectStore.createProject({
            path: directory.path,
            cloneUrl,
            authToken,
            username,
            email,
          })
        ),
        Effect.bind('currentBranch', ({ versionedProjectStore, projectId }) =>
          versionedProjectStore.getCurrentBranch({ projectId })
        ),
        Effect.bind(
          'mergeConflictInfo',
          ({ versionedProjectStore, projectId }) =>
            versionedProjectStore.getMergeConflictInfo({ projectId })
        ),
        Effect.bind('remoteProjects', ({ versionedProjectStore, projectId }) =>
          versionedProjectStore.listRemoteProjects({ projectId })
        ),
        Effect.map(
          ({
            directory,
            versionedProjectStore,
            projectId,
            currentBranch,
            mergeConflictInfo,
            remoteProjects,
          }) => ({
            versionedProjectStore,
            versionedDocumentStore: createVersionedDocumentStoreAdapter({
              isoGitFs: fs,
              filesystem,
              projectId,
              projectDir: projectId,
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
    ({ filesystem }) =>
    ({ projectId, directoryPath, username, email }) =>
      Effect.Do.pipe(
        Effect.bind('directory', () => filesystem.getDirectory(directoryPath)),
        Effect.bind('versionedProjectStore', () =>
          Effect.succeed(
            createProjectStoreAdapter({
              isoGitFs: fs,
              isoGitHttp: http,
              filesystem,
              documentAnalyzer,
              assetsDirName,
            })
          )
        ),
        Effect.tap(({ versionedProjectStore }) =>
          versionedProjectStore.setAuthorInfo({
            projectId,
            username,
            email,
          })
        ),
        Effect.bind('currentBranch', ({ versionedProjectStore }) =>
          versionedProjectStore.getCurrentBranch({ projectId })
        ),
        Effect.bind('mergeConflictInfo', ({ versionedProjectStore }) =>
          versionedProjectStore.getMergeConflictInfo({ projectId })
        ),
        Effect.bind('remoteProjects', ({ versionedProjectStore }) =>
          versionedProjectStore.listRemoteProjects({ projectId })
        ),
        Effect.map(
          ({
            directory,
            versionedProjectStore,
            currentBranch,
            mergeConflictInfo,
            remoteProjects,
          }) => ({
            versionedProjectStore,
            versionedDocumentStore: createVersionedDocumentStoreAdapter({
              isoGitFs: fs,
              filesystem,
              projectId,
              projectDir: projectId,
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
