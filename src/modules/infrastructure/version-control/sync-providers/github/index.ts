import type { Endpoints } from '@octokit/types';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import { mapErrorTo } from '../../../../../utils/errors';
import { SyncProviderError } from '../../errors';
import { type Branch } from '../../models';

type GetRepositoriesResponse = Endpoints['GET /user/repos']['response']['data'];

export type GithubRepositoryInfo = {
  id: number;
  name: string;
  fullName: string;
  private: boolean;
  defaultBranch: Branch;
  cloneUrl: string;
  sshUrl: string;
};

const GET_REPOS_URL = 'https://api.github.com/user/repos';

export const getGithubUserRepositories = (
  userToken: string
): Effect.Effect<GithubRepositoryInfo[], SyncProviderError, never> =>
  pipe(
    Effect.tryPromise({
      try: async () => {
        const response = await fetch(GET_REPOS_URL, {
          headers: {
            Authorization: `Bearer ${userToken}`,
            Accept: 'application/vnd.github+json',
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to get repos: ${response.statusText}`);
        }

        return (await response.json()) as GetRepositoriesResponse;
      },
      catch: mapErrorTo(SyncProviderError, 'Error getting user repositories'),
    }),
    Effect.map((repos) =>
      repos.map((repo) => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        private: repo.private,
        // TODO: Consider validating the branch.
        defaultBranch: repo.default_branch as Branch,
        cloneUrl: repo.clone_url,
        sshUrl: repo.ssh_url,
      }))
    )
  );
