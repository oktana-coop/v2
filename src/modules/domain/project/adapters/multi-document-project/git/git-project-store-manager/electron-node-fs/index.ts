import fs from 'node:fs';

import * as Effect from 'effect/Effect';
import http from 'isomorphic-git/http/node';

import { createAdapter as createVersionedDocumentStoreAdapter } from '../../../../../../../../modules/domain/rich-text/adapters/versioned-document-store/git/git-versioned-document-store';
import { type MultiDocumentProjectStoreManager } from '../../../../../ports';
import { createAdapter as createMultiDocumentProjectStoreAdapter } from '../../git-project-store';

export const createAdapter = (): MultiDocumentProjectStoreManager => {
  const openOrCreateMultiDocumentProject: MultiDocumentProjectStoreManager['openOrCreateMultiDocumentProject'] =

      ({ filesystem }) =>
      ({ username, email, cloneUrl, authToken }) =>
        Effect.Do.pipe(
          Effect.bind('directory', () => filesystem.openDirectory()),
          Effect.bind('versionedProjectStore', () =>
            Effect.succeed(
              createMultiDocumentProjectStoreAdapter({
                isoGitFs: fs,
                isoGitHttp: http,
                filesystem,
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
            'remoteProjects',
            ({ versionedProjectStore, projectId }) =>
              versionedProjectStore.listRemoteProjects({ projectId })
          ),
          Effect.map(
            ({
              directory,
              versionedProjectStore,
              projectId,
              currentBranch,
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
              remoteProjects,
            })
          )
        );

  const openMultiDocumentProjectById: MultiDocumentProjectStoreManager['openMultiDocumentProjectById'] =

      ({ filesystem }) =>
      ({ projectId, directoryPath, username, email }) =>
        Effect.Do.pipe(
          Effect.bind('directory', () =>
            filesystem.getDirectory(directoryPath)
          ),
          Effect.bind('versionedProjectStore', () =>
            Effect.succeed(
              createMultiDocumentProjectStoreAdapter({
                isoGitFs: fs,
                isoGitHttp: http,
                filesystem,
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
          Effect.bind('remoteProjects', ({ versionedProjectStore }) =>
            versionedProjectStore.listRemoteProjects({ projectId })
          ),
          Effect.map(
            ({
              directory,
              versionedProjectStore,
              currentBranch,
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
              remoteProjects,
            })
          )
        );

  return {
    openOrCreateMultiDocumentProject,
    openMultiDocumentProjectById,
  };
};
