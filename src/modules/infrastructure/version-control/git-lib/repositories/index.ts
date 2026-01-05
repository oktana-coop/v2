import * as Effect from 'effect/Effect';
import git from 'isomorphic-git';

import { mapErrorTo } from '../../../../../utils/errors';
import { RepositoryError } from '../../errors';
import { authCallback } from '../auth';
import { IsoGitDeps } from '../types';

type CloneRepositoryArgs = IsoGitDeps & {
  url: string;
  authToken: string;
};

export const cloneRepository = ({
  isoGitFs,
  isoGitHttp,
  dir,
  url,
  authToken,
}: CloneRepositoryArgs): Effect.Effect<void, RepositoryError, never> =>
  Effect.tryPromise({
    try: () =>
      git.clone({
        fs: isoGitFs,
        http: isoGitHttp,
        dir,
        url,
        onAuth: authCallback(authToken),
      }),
    catch: mapErrorTo(RepositoryError, 'Error in cloning git repo'),
  });
