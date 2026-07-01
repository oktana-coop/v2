import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import {
  type HttpClient as IsoGitHttpApi,
  type PromiseFsClient as IsoGitFsApi,
} from 'isomorphic-git';

import {
  findRemoteByName as findGitRemoteByName,
  getRemoteBranchInfo as getRemoteBranchInfoWithGit,
  listRemotes as listGitRemotes,
  pullFromRemote as pullFromRemoteGitRepo,
  pushToRemote as pushToRemoteGitRepo,
  validateAndAddRemote,
  VersionControlNotFoundErrorTag,
  VersionControlRepositoryErrorTag,
} from '../../../../../../modules/infrastructure/version-control';
import { NotFoundError, RepositoryError } from '../../../errors';
import { type ProjectStore } from '../../../ports';
import { ensureAuthTokenIsProvided } from './auth';
import { ensureProjectIdIsFsPath } from './project-id';

type RemoteOps = Pick<
  ProjectStore,
  | 'addRemoteProject'
  | 'listRemoteProjects'
  | 'findRemoteProjectByName'
  | 'pushToRemoteProject'
  | 'pullFromRemoteProject'
  | 'getRemoteBranchInfo'
>;

export const createRemoteOps = ({
  isoGitFs,
  isoGitHttp,
}: {
  isoGitFs: IsoGitFsApi;
  isoGitHttp: IsoGitHttpApi;
}): RemoteOps => {
  const addRemoteProject: RemoteOps['addRemoteProject'] = ({
    projectId,
    remoteName = 'origin',
    remoteUrl,
    authToken: authTokenInput,
  }) =>
    Effect.Do.pipe(
      Effect.bind('authToken', () => ensureAuthTokenIsProvided(authTokenInput)),
      Effect.bind('projectPath', () => ensureProjectIdIsFsPath(projectId)),
      Effect.flatMap(({ authToken, projectPath }) =>
        pipe(
          validateAndAddRemote({
            isoGitFs,
            isoGitHttp,
            dir: projectPath,
            name: remoteName,
            url: remoteUrl,
            authToken,
          }),
          Effect.catchTag(VersionControlRepositoryErrorTag, (err) =>
            Effect.fail(new RepositoryError(err.message))
          )
        )
      )
    );

  const listRemoteProjects: RemoteOps['listRemoteProjects'] = ({ projectId }) =>
    pipe(
      ensureProjectIdIsFsPath(projectId),
      Effect.flatMap((projectPath) =>
        pipe(
          listGitRemotes({
            isoGitFs,
            dir: projectPath,
          }),
          Effect.catchTag(VersionControlRepositoryErrorTag, (err) =>
            Effect.fail(new RepositoryError(err.message))
          ),
          Effect.flatMap((remotes) =>
            Effect.succeed(
              remotes.map((remote) => ({
                name: remote.remote,
                url: remote.url,
              }))
            )
          )
        )
      )
    );

  const findRemoteProjectByName: RemoteOps['findRemoteProjectByName'] = ({
    projectId,
    remoteName = 'origin',
  }) =>
    pipe(
      ensureProjectIdIsFsPath(projectId),
      Effect.flatMap((projectPath) =>
        pipe(
          findGitRemoteByName({
            isoGitFs,
            dir: projectPath,
            name: remoteName,
          }),
          Effect.catchTag(VersionControlRepositoryErrorTag, (err) =>
            Effect.fail(new RepositoryError(err.message))
          ),
          Effect.catchTag(VersionControlNotFoundErrorTag, (err) =>
            Effect.fail(new NotFoundError(err.message))
          ),
          Effect.map((remoteInfo) => ({
            name: remoteInfo.remote,
            url: remoteInfo.url,
          }))
        )
      )
    );

  const pushToRemoteProject: RemoteOps['pushToRemoteProject'] = ({
    projectId,
    remoteName = 'origin',
    authToken: authTokenInput,
  }) =>
    Effect.Do.pipe(
      Effect.bind('authToken', () => ensureAuthTokenIsProvided(authTokenInput)),
      Effect.bind('projectPath', () => ensureProjectIdIsFsPath(projectId)),
      Effect.flatMap(({ authToken, projectPath }) =>
        pipe(
          pushToRemoteGitRepo({
            isoGitFs,
            isoGitHttp,
            dir: projectPath,
            remote: remoteName,
            authToken,
          }),
          Effect.catchTag(VersionControlRepositoryErrorTag, (err) =>
            Effect.fail(new RepositoryError(err.message))
          )
        )
      )
    );

  const pullFromRemoteProject: RemoteOps['pullFromRemoteProject'] = ({
    projectId,
    remoteName = 'origin',
    authToken: authTokenInput,
  }) =>
    Effect.Do.pipe(
      Effect.bind('authToken', () => ensureAuthTokenIsProvided(authTokenInput)),
      Effect.bind('projectPath', () => ensureProjectIdIsFsPath(projectId)),
      Effect.flatMap(({ authToken, projectPath }) =>
        pipe(
          pullFromRemoteGitRepo({
            isoGitFs,
            isoGitHttp,
            dir: projectPath,
            remote: remoteName,
            authToken,
          }),
          Effect.catchTag(VersionControlRepositoryErrorTag, (err) =>
            Effect.fail(new RepositoryError(err.message))
          )
        )
      )
    );

  const getRemoteBranchInfo: RemoteOps['getRemoteBranchInfo'] = ({
    projectId,
    remoteName = 'origin',
    authToken: authTokenInput,
  }) =>
    Effect.Do.pipe(
      Effect.bind('authToken', () => ensureAuthTokenIsProvided(authTokenInput)),
      Effect.bind('projectPath', () => ensureProjectIdIsFsPath(projectId)),
      Effect.flatMap(({ projectPath, authToken }) =>
        pipe(
          findGitRemoteByName({
            isoGitFs,
            dir: projectPath,
            name: remoteName,
          }),
          Effect.catchTag(VersionControlRepositoryErrorTag, (err) =>
            Effect.fail(new RepositoryError(err.message))
          ),
          Effect.catchTag(VersionControlNotFoundErrorTag, (err) =>
            Effect.fail(new NotFoundError(err.message))
          ),
          Effect.flatMap((remoteInfo) =>
            pipe(
              getRemoteBranchInfoWithGit({
                isoGitHttp,
                url: remoteInfo.url,
                authToken,
              }),
              Effect.catchAll((err) =>
                Effect.fail(new RepositoryError(err.message))
              )
            )
          )
        )
      )
    );

  return {
    addRemoteProject,
    listRemoteProjects,
    findRemoteProjectByName,
    pushToRemoteProject,
    pullFromRemoteProject,
    getRemoteBranchInfo,
  };
};
