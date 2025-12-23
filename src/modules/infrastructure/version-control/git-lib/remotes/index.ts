import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import git from 'isomorphic-git';

import { mapErrorTo } from '../../../../../utils/errors';
import { RepositoryError } from '../../errors';
import { type Branch } from '../../models';
import { IsoGitDeps } from '../types';

type ValidateRemoteConnectivityAndAuthArgs = Pick<IsoGitDeps, 'isoGitHttp'> & {
  url: string;
  authToken: string;
};

const authCallback = (authToken: string) => () => ({
  username: 'oauth2', // arbitrary / doesn't matter for token auth
  password: authToken,
});

const validateRemoteConnectivityAndAuth = ({
  isoGitHttp,
  url,
  authToken,
}: ValidateRemoteConnectivityAndAuthArgs): Effect.Effect<
  void,
  RepositoryError,
  never
> =>
  Effect.tryPromise({
    try: () =>
      git.listServerRefs({
        http: isoGitHttp,
        url,
        onAuth: authCallback(authToken),
      }),
    catch: mapErrorTo(
      RepositoryError,
      `Error in validate remote connectivity for ${url}`
    ),
  });

type AddRemoteArgs = Omit<IsoGitDeps, 'isoGitHttp'> & {
  name: string;
  url: string;
};

const addRemote = ({
  isoGitFs,
  dir,
  name,
  url,
}: AddRemoteArgs): Effect.Effect<void, RepositoryError, never> =>
  Effect.tryPromise({
    try: () =>
      git.addRemote({
        fs: isoGitFs,
        dir,
        remote: name,
        url,
      }),
    catch: mapErrorTo(RepositoryError, 'Error in adding remote to git repo'),
  });

export type ValidateAndAddRemoteArgs = ValidateRemoteConnectivityAndAuthArgs &
  AddRemoteArgs;

export const validateAndAddRemote = ({
  isoGitFs,
  isoGitHttp,
  dir,
  name,
  url,
  authToken,
}: ValidateAndAddRemoteArgs): Effect.Effect<void, RepositoryError, never> =>
  pipe(
    validateRemoteConnectivityAndAuth({
      isoGitHttp,
      url,
      authToken,
    }),
    Effect.flatMap(() =>
      addRemote({
        isoGitFs,
        dir,
        name,
        url,
      })
    )
  );

export type PushToRemoteArgs = IsoGitDeps & {
  remote: string;
  authToken: string;
};

export const pushToRemote = ({
  isoGitFs,
  isoGitHttp,
  dir,
  remote,
  authToken,
}: PushToRemoteArgs): Effect.Effect<void, RepositoryError, never> =>
  Effect.tryPromise({
    try: () =>
      git.push({
        fs: isoGitFs,
        http: isoGitHttp,
        dir,
        remote,
        onAuth: authCallback(authToken),
      }),
    catch: mapErrorTo(RepositoryError, 'Error in pushing to remote git repo'),
  });

export type PullFromRemoteArgs = IsoGitDeps & {
  remote: string;
  authToken: string;
};

export const pullFromRemote = ({
  isoGitFs,
  isoGitHttp,
  dir,
  remote,
  authToken,
}: PullFromRemoteArgs): Effect.Effect<void, RepositoryError, never> =>
  Effect.tryPromise({
    try: () =>
      git.pull({
        fs: isoGitFs,
        http: isoGitHttp,
        dir,
        remote,
        onAuth: authCallback(authToken),
        fastForwardOnly: true,
      }),
    catch: mapErrorTo(RepositoryError, 'Error in pulling from remote git repo'),
  });
