import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import { DEFAULT_AUTHOR_EMAIL, DEFAULT_AUTHOR_NAME } from '../../constants';
import { RepositoryError } from '../../errors';
import { getUserInfo } from '../config';
import { type IsoGitDeps } from '../types';

export type CommitAuthor = {
  name: string;
  email: string;
};

export const DEFAULT_AUTHOR: CommitAuthor = {
  name: DEFAULT_AUTHOR_NAME,
  email: DEFAULT_AUTHOR_EMAIL,
};

export type ResolveAuthorArgs = Omit<IsoGitDeps, 'isoGitHttp'> & {
  author?: CommitAuthor;
};

// Without an explicit author, the commit is attributed to whoever the repo
// config says is writing, falling back to the default (bot) author.
export const resolveAuthor = ({
  isoGitFs,
  dir,
  author,
}: ResolveAuthorArgs): Effect.Effect<CommitAuthor, RepositoryError, never> =>
  author
    ? Effect.succeed(author)
    : pipe(
        getUserInfo({ isoGitFs, dir }),
        Effect.map((repoUserInfo) => ({
          name: repoUserInfo.username ?? DEFAULT_AUTHOR.name,
          email: repoUserInfo.email ?? DEFAULT_AUTHOR.email,
        }))
      );
