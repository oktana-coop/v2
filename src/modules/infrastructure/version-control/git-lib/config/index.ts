import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import git from 'isomorphic-git';

import { mapErrorTo } from '../../../../../utils/errors';
import { RepositoryError } from '../../errors';
import { IsoGitDeps } from '../types';

export type SetAuthorInfoArgs = IsoGitDeps & {
  username: string | null;
  email: string | null;
};

export const setAuthorInfo = ({
  isoGitFs,
  dir,
  username,
  email,
}: SetAuthorInfoArgs): Effect.Effect<void, RepositoryError, never> =>
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
