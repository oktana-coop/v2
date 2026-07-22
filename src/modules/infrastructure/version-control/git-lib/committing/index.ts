import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import git from 'isomorphic-git';

import { mapErrorTo } from '../../../../../utils/errors';
import { RepositoryError } from '../../errors';
import { type Commit } from '../../models';
import { parseGitCommitHash } from '../../models';
import { stageFiles, stageWorkdirChanges } from '../staging-area';
import { type IsoGitDeps } from '../types';
import { type CommitAuthor, resolveAuthor } from './authorship';

export * from './authorship';

export type CommitStagedChangesArgs = Omit<IsoGitDeps, 'isoGitHttp'> & {
  message: string;
  author?: CommitAuthor;
};

export const commitStagedChanges = ({
  isoGitFs,
  dir,
  message,
  author,
}: CommitStagedChangesArgs): Effect.Effect<
  Commit['id'],
  RepositoryError,
  never
> =>
  pipe(
    resolveAuthor({ isoGitFs, dir, author }),
    Effect.flatMap((commitAuthor) =>
      Effect.tryPromise({
        try: () =>
          git.commit({
            fs: isoGitFs,
            dir,
            author: commitAuthor,
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
  author?: CommitAuthor;
};

export const stageAndCommitWorkdirChanges = ({
  isoGitFs,
  dir,
  message,
  author,
}: StageAndCommitWorkdirChangesArgs): Effect.Effect<
  Commit['id'],
  RepositoryError,
  never
> =>
  pipe(
    stageWorkdirChanges({ isoGitFs, dir }),
    Effect.flatMap(() =>
      commitStagedChanges({ isoGitFs, dir, message, author })
    )
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
