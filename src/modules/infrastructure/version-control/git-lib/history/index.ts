import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import git, {
  Errors as IsoGitErrors,
  type ReadCommitResult,
} from 'isomorphic-git';

import { mapErrorTo } from '../../../../../utils/errors';
import { parseUsername } from '../../../../auth';
import {
  NotFoundError,
  RepositoryError,
  VersionControlNotFoundErrorTag,
} from '../../errors';
import { type Branch, type Commit, parseGitCommitHash } from '../../models';
import { IsoGitDeps } from '../types';

export const logResultToCommits = (
  loggedCommits: ReadCommitResult[]
): Effect.Effect<Commit[], RepositoryError, never> =>
  Effect.forEach(loggedCommits, (commitInfo) =>
    pipe(
      Effect.try({
        try: () => parseUsername(commitInfo.commit.author.name),
        catch: mapErrorTo(RepositoryError, 'Error reading commit author name'),
      }),
      Effect.map((authorUsername) => ({
        // TODO: Handle parsing errors
        id: parseGitCommitHash(commitInfo.oid),
        message: commitInfo.commit.message,
        time: new Date(commitInfo.commit.author.timestamp * 1000),
        author: {
          username: authorUsername,
        },
      }))
    )
  );

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
