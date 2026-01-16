import * as Effect from 'effect/Effect';
import git from 'isomorphic-git';

import { mapErrorTo } from '../../../../../utils/errors';
import { RepositoryError } from '../../errors';
import { type IsoGitDeps } from '../types';

export type RemoveFileArgs = Omit<IsoGitDeps, 'isoGitHttp'> & {
  path: string;
};

export const removeFile = ({
  isoGitFs,
  dir,
  path,
}: RemoveFileArgs): Effect.Effect<void, RepositoryError, never> =>
  Effect.tryPromise({
    try: () =>
      git.remove({
        fs: isoGitFs,
        dir,
        filepath: path,
      }),
    catch: mapErrorTo(RepositoryError, 'Error in removing file from Git.'),
  });

export const stageFile = ({
  isoGitFs,
  dir,
  path,
}: RemoveFileArgs): Effect.Effect<void, RepositoryError, never> =>
  Effect.tryPromise({
    try: () =>
      git.add({
        fs: isoGitFs,
        dir,
        filepath: path,
      }),
    catch: mapErrorTo(
      RepositoryError,
      'Error in adding file to the Git index.'
    ),
  });
