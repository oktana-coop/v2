import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import git from 'isomorphic-git';

import { mapErrorTo } from '../../../../../utils/errors';
import { DEFAULT_AUTHOR_NAME } from '../../constants';
import { RepositoryError } from '../../errors';
import { type Commit } from '../../models';
import { parseGitCommitHash } from '../../models';
import { getUserInfo } from '../config';
import { type IsoGitDeps } from '../types';

export type StageAndCommitWorkdirChangesArgs = Omit<
  IsoGitDeps,
  'isoGitHttp'
> & {
  message: string;
};

export const stageAndCommitWorkdirChanges = ({
  isoGitFs,
  dir,
  message,
}: StageAndCommitWorkdirChangesArgs): Effect.Effect<
  Commit['id'],
  RepositoryError,
  never
> =>
  pipe(
    getUserInfo({ isoGitFs, dir }),
    Effect.flatMap((repoUserInfo) =>
      pipe(
        Effect.tryPromise({
          try: () =>
            git.add({
              fs: isoGitFs,
              dir,
              filepath: '.',
            }),
          catch: mapErrorTo(
            RepositoryError,
            'Error in adding changes to the Git index.'
          ),
        }),
        Effect.flatMap(() =>
          Effect.tryPromise({
            try: () =>
              git.commit({
                fs: isoGitFs,
                dir,
                author: {
                  name: repoUserInfo.username ?? DEFAULT_AUTHOR_NAME,
                  email: repoUserInfo.email ?? undefined,
                },
                message,
              }),
            catch: mapErrorTo(
              RepositoryError,
              'Error in committing changes to Git.'
            ),
          })
        ),
        Effect.flatMap((commitHashStr) =>
          Effect.try({
            try: () => parseGitCommitHash(commitHashStr),
            catch: mapErrorTo(
              RepositoryError,
              'Error in parsing the commit hash.'
            ),
          })
        )
      )
    )
  );
