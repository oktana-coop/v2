import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import git from 'isomorphic-git';

import { mapErrorTo } from '../../../../../utils/errors';
import { RepositoryError } from '../../errors';
import { IsoGitDeps } from '../types';

export type SetUserInfoArgs = Omit<IsoGitDeps, 'isoGitHttp'> & {
  username: string | null;
  email: string | null;
};

export type GetUserInfoArgs = Omit<IsoGitDeps, 'isoGitHttp'>;

export type GetUserInfoResponse = {
  username: string | null;
  email: string | null;
};

export const setUserInfo = ({
  isoGitFs,
  dir,
  username,
  email,
}: SetUserInfoArgs): Effect.Effect<void, RepositoryError, never> =>
  pipe(
    Effect.tryPromise({
      try: () =>
        git.setConfig({
          fs: isoGitFs,
          dir,
          path: 'user.name',
          value: username ?? undefined,
        }),
      catch: mapErrorTo(
        RepositoryError,
        'Error in setting the username in git repo config'
      ),
    }),
    Effect.tap(() =>
      Effect.tryPromise({
        try: () =>
          git.setConfig({
            fs: isoGitFs,
            dir,
            path: 'user.email',
            value: email ?? undefined,
          }),
        catch: mapErrorTo(
          RepositoryError,
          'Error in setting the email in git repo config'
        ),
      })
    )
  );

export const getUserInfo = ({
  isoGitFs,
  dir,
}: GetUserInfoArgs): Effect.Effect<
  GetUserInfoResponse,
  RepositoryError,
  never
> =>
  Effect.Do.pipe(
    Effect.bind('username', () =>
      pipe(
        Effect.tryPromise({
          try: () =>
            git.getConfig({
              fs: isoGitFs,
              dir,
              path: 'user.name',
            }),
          catch: mapErrorTo(
            RepositoryError,
            'Error in getting the username from the git repo config'
          ),
        }),
        Effect.map((username) => (username ? String(username) : null))
      )
    ),
    Effect.bind('email', () =>
      pipe(
        Effect.tryPromise({
          try: () =>
            git.getConfig({
              fs: isoGitFs,
              dir,
              path: 'user.email',
            }),
          catch: mapErrorTo(
            RepositoryError,
            'Error in getting the email from the git repo config'
          ),
        }),
        Effect.map((email) => (email ? String(email) : null))
      )
    )
  );
