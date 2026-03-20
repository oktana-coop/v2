import * as Effect from 'effect/Effect';
import git from 'isomorphic-git';

import { mapErrorTo } from '../../../../../utils/errors';
import { RepositoryError } from '../../errors';
import { type IsoGitDeps } from '../types';

type StagingAreaDeps = Omit<IsoGitDeps, 'isoGitHttp'>;

export type RemoveFileArgs = StagingAreaDeps & {
  path: string;
};

export const hasStagedChanges = ({
  isoGitFs,
  dir,
}: StagingAreaDeps): Effect.Effect<boolean, RepositoryError, never> =>
  Effect.tryPromise({
    try: async () => {
      const matrix = await git.statusMatrix({ fs: isoGitFs, dir });
      // statusMatrix returns [filepath, HEAD, WORKDIR, STAGE]
      // A file has staged changes when HEAD !== STAGE (index 0 !== index 2)
      return matrix.some(([, head, , stage]) => head !== stage);
    },
    catch: mapErrorTo(RepositoryError, 'Error checking staged changes'),
  });

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
