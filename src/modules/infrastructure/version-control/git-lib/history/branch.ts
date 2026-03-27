import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import git, { Errors as IsoGitErrors } from 'isomorphic-git';

import {
  NotFoundError,
  RepositoryError,
  VersionControlNotFoundErrorTag,
} from '../../errors';
import { type Branch, type Commit } from '../../models';
import { IsoGitDeps } from '../types';
import { logResultToCommits } from './log';

export type GetBranchCommitHistoryArgs = Omit<IsoGitDeps, 'isoGitHttp'> & {
  branch: Branch;
  limit?: number;
};

export const getBranchCommitHistory = ({
  isoGitFs,
  dir,
  branch,
  limit,
}: GetBranchCommitHistoryArgs): Effect.Effect<
  Commit[],
  RepositoryError | NotFoundError,
  never
> =>
  pipe(
    Effect.tryPromise({
      try: () =>
        git.log({
          fs: isoGitFs,
          dir,
          ref: branch,
          depth: limit,
        }),
      catch: (err) => {
        if (err instanceof IsoGitErrors.NotFoundError) {
          return new NotFoundError('No commit found');
        }

        return new RepositoryError('Git repo error');
      },
    }),
    Effect.catchTag(VersionControlNotFoundErrorTag, () => Effect.succeed([])),
    Effect.flatMap((logResult) => logResultToCommits(logResult))
  );
