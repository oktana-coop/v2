import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import git from 'isomorphic-git';

import { mapErrorTo } from '../../../../../utils/errors';
import { DEFAULT_AUTHOR_NAME } from '../../constants';
import { RepositoryError } from '../../errors';
import { type Commit } from '../../models';
import { parseGitCommitHash } from '../../models';
import { getUserInfo } from '../config';
import { stageFiles, stageWorkdirChanges } from '../staging-area';
import { type IsoGitDeps } from '../types';

export type CommitStagedChangesArgs = Omit<IsoGitDeps, 'isoGitHttp'> & {
  message: string;
};

export const commitStagedChanges = ({
  isoGitFs,
  dir,
  message,
}: CommitStagedChangesArgs): Effect.Effect<
  Commit['id'],
  RepositoryError,
  never
> =>
  pipe(
    getUserInfo({ isoGitFs, dir }),
    Effect.flatMap((repoUserInfo) =>
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
        catch: mapErrorTo(RepositoryError, 'Error in parsing the commit hash.'),
      })
    )
  );

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
    stageWorkdirChanges({ isoGitFs, dir }),
    Effect.flatMap(() => commitStagedChanges({ isoGitFs, dir, message }))
  );

export type StageAndCommitChangesToFilesArgs = Omit<
  IsoGitDeps,
  'isoGitHttp'
> & {
  paths: string[];
  message: string;
};

// Stages the given project-relative paths and produces a commit. Narrower
// than `stageAndCommitWorkdirChanges` — only the listed files end up in
// the commit, regardless of other dirty entries in the working tree.
export const stageAndCommitChangesToFiles = ({
  isoGitFs,
  dir,
  paths,
  message,
}: StageAndCommitChangesToFilesArgs): Effect.Effect<
  Commit['id'],
  RepositoryError,
  never
> =>
  pipe(
    stageFiles({ isoGitFs, dir, paths }),
    Effect.flatMap(() => commitStagedChanges({ isoGitFs, dir, message }))
  );
