import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import git, { Errors as IsoGitErrors } from 'isomorphic-git';

import { NotFoundError, RepositoryError } from '../../errors';
import { type GitCommitHash } from '../../models';
import { type IsoGitDeps } from '../types';

export type ReadBlobAtCommitArgs = Omit<IsoGitDeps, 'isoGitHttp'> & {
  commitHash: GitCommitHash;
  filepath: string;
};

export const readBlobAtCommit = ({
  isoGitFs,
  dir,
  commitHash,
  filepath,
}: ReadBlobAtCommitArgs): Effect.Effect<
  Uint8Array,
  NotFoundError | RepositoryError,
  never
> =>
  pipe(
    Effect.tryPromise({
      try: () =>
        git.readBlob({
          fs: isoGitFs,
          dir,
          oid: commitHash,
          filepath,
        }),
      catch: (err) =>
        err instanceof IsoGitErrors.NotFoundError
          ? new NotFoundError(
              `File '${filepath}' not found at commit ${commitHash}`
            )
          : new RepositoryError('Error reading blob from git'),
    }),
    Effect.map((res) => res.blob)
  );
