import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import { type ReadCommitResult } from 'isomorphic-git';

import { mapErrorTo } from '../../../../../utils/errors';
import { parseUsername } from '../../../../auth';
import { RepositoryError } from '../../errors';
import { type Commit, parseGitCommitHash } from '../../models';

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
