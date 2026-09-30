import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import git from 'isomorphic-git';

import { mapErrorTo } from '../../../../../utils/errors';
import { RepositoryError, VersionControlNotFoundErrorTag } from '../../errors';
import {
  type DecomposedGitRef,
  type GitCommitHash,
  parseGitCommitHash,
} from '../../models';
import { getCurrentBranch } from '../branching';
import { IsoGitDeps } from '../types';

export type GetCommitForRefArgs = Omit<IsoGitDeps, 'isoGitHttp'> & {
  ref: string;
};

export const getCommitForRef = ({
  ref,
  isoGitFs,
  dir,
}: GetCommitForRefArgs): Effect.Effect<GitCommitHash, RepositoryError, never> =>
  pipe(
    Effect.tryPromise({
      try: () =>
        git.resolveRef({
          fs: isoGitFs,
          dir,
          ref,
        }),
      catch: mapErrorTo(RepositoryError, 'Error in resolving Git ref.'),
    }),
    Effect.flatMap((commitOid) =>
      Effect.try({
        try: () => parseGitCommitHash(commitOid),
        catch: mapErrorTo(
          RepositoryError,
          'Error in resolving Git ref commit id.'
        ),
      })
    )
  );

export type IsRefCheckedOutArgs = Omit<IsoGitDeps, 'isoGitHttp'> &
  Pick<DecomposedGitRef, 'ref' | 'refType'>;

// Whether HEAD is at the ref: on the branch, or at the commit, attached or
// detached.
export const isRefCheckedOut = ({
  isoGitFs,
  dir,
  ref,
  refType,
}: IsRefCheckedOutArgs): Effect.Effect<boolean, RepositoryError, never> =>
  refType === 'commit'
    ? pipe(
        getCommitForRef({ isoGitFs, dir, ref: 'HEAD' }),
        // The commit may be given by a prefix of its hash.
        Effect.map((commit) => commit.startsWith(ref))
      )
    : pipe(
        // The app does not handle tags yet, so a ref that is not a commit is a
        // branch.
        //
        // TODO: Handle tags.
        getCurrentBranch({ isoGitFs, dir }),
        Effect.map((branch) => branch === ref),
        Effect.catchTag(VersionControlNotFoundErrorTag, () =>
          Effect.succeed(false)
        )
      );
