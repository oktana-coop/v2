import * as Effect from 'effect/Effect';
import git from 'isomorphic-git';
import path from 'path';

import { mapErrorTo } from '../../../../../utils/errors';
import { RepositoryError } from '../../errors';
import { authCallback } from '../auth';
import { pathExists } from '../fs-utils';
import { IsoGitDeps } from '../types';

export type RepositoryExistsArgs = Omit<IsoGitDeps, 'isoGitHttp'>;

export const repositoryExists = ({
  isoGitFs,
  dir,
}: RepositoryExistsArgs): Effect.Effect<boolean, RepositoryError, never> =>
  pathExists({ isoGitFs, filePath: path.join(dir, '.git') });

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
