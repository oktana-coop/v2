import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import { type PromiseFsClient as IsoGitFsApi } from 'isomorphic-git';

import {
  NotFoundError,
  RepositoryError,
  VersionControlNotFoundErrorTag,
} from '../errors';

export type PathExistsArgs = {
  isoGitFs: IsoGitFsApi;
  filePath: string;
};

const isMissingPathError = (err: unknown): boolean =>
  typeof err === 'object' &&
  err !== null &&
  'code' in err &&
  (err.code === 'ENOENT' || err.code === 'ENOTDIR');

export const pathExists = ({
  isoGitFs,
  filePath,
}: PathExistsArgs): Effect.Effect<boolean, RepositoryError, never> =>
  pipe(
    Effect.tryPromise({
      try: () => isoGitFs.promises.stat(filePath),
      catch: (err) =>
        isMissingPathError(err)
          ? new NotFoundError(`${filePath} does not exist`)
          : new RepositoryError(`Error in checking if ${filePath} exists`),
    }),
    Effect.map(() => true),
    Effect.catchTag(VersionControlNotFoundErrorTag, () => Effect.succeed(false))
  );
