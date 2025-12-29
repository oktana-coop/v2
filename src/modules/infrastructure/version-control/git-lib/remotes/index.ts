import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import git from 'isomorphic-git';

import { mapErrorTo } from '../../../../../utils/errors';
import { NotFoundError, RepositoryError } from '../../errors';
import {
  type Branch,
  type Commit,
  parseBranch,
  parseGitCommitHash,
} from '../../models';
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
      git.getRemoteInfo({
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

type ListRemotesArgs = Omit<IsoGitDeps, 'isoGitHttp'>;

type RemoteInfo = { remote: string; url: string };

export const listRemotes = ({
  isoGitFs,
  dir,
}: ListRemotesArgs): Effect.Effect<RemoteInfo[], RepositoryError, never> =>
  Effect.tryPromise({
    try: () =>
      git.listRemotes({
        fs: isoGitFs,
        dir,
      }),
    catch: mapErrorTo(RepositoryError, 'Error in listing git remotes'),
  });

type FindRemoteByNameValidatingConnectivityAndAuthArgs = Omit<
  IsoGitDeps,
  'isoGitHttp'
> & {
  name: string;
};

export const findRemoteByName = ({
  isoGitFs,
  dir,
  name,
}: FindRemoteByNameValidatingConnectivityAndAuthArgs): Effect.Effect<
  RemoteInfo,
  NotFoundError | RepositoryError,
  never
> =>
  pipe(
    listRemotes({ isoGitFs, dir }),
    Effect.flatMap((remotes) => {
      const remote = remotes.find((r) => r.remote === name);

      return remote
        ? Effect.succeed(remote)
        : Effect.fail(new NotFoundError(`Remote with name ${name} not found`));
    })
  );

export type GetRemoteBranchInfoArgs = Pick<IsoGitDeps, 'isoGitHttp'> & {
  url: string;
  authToken: string;
};

export type GetRemoteBranchInfoResult = Record<Branch, Commit['id']>;

export const getRemoteBranchInfo = ({
  isoGitHttp,
  url,
  authToken,
}: GetRemoteBranchInfoArgs): Effect.Effect<
  GetRemoteBranchInfoResult,
  RepositoryError,
  never
> =>
  pipe(
    Effect.tryPromise({
      try: () =>
        git.listServerRefs({
          http: isoGitHttp,
          url,
          onAuth: authCallback(authToken),
        }),
      catch: mapErrorTo(
        RepositoryError,
        `Error in getting remote info for ${url}`
      ),
    }),
    Effect.map((remoteRefs) =>
      remoteRefs.filter((ref) => ref.ref.startsWith('refs/heads/'))
    ),
    Effect.flatMap((remoteBranchRefs) =>
      Effect.forEach(remoteBranchRefs, (ref) => {
        const match = ref.ref.match(/^refs\/heads\/(.+)$/);
        if (match) {
          const branchName = match[1];

          return Effect.Do.pipe(
            Effect.bind('branch', () =>
              Effect.try({
                try: () => parseBranch(branchName),
                catch: mapErrorTo(
                  RepositoryError,
                  'Could not parse branch name from remote ref'
                ),
              })
            ),
            Effect.bind('commitId', () =>
              Effect.try({
                try: () => parseGitCommitHash(ref.oid),
                catch: mapErrorTo(
                  RepositoryError,
                  'Could not parse commit ID from remote ref'
                ),
              })
            ),
            Effect.map(
              ({ branch, commitId }) =>
                ({
                  [branch]: commitId,
                }) as Record<Branch, Commit['id']>
            )
          );
        } else {
          return Effect.fail(
            new RepositoryError(`Unexpected ref format from remote: ${ref.ref}`)
          );
        }
      })
    ),
    Effect.map((branchRecords) =>
      branchRecords.reduce((acc, record) => ({ ...acc, ...record }), {})
    )
  );
