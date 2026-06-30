import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as Option from 'effect/Option';
import { type PromiseFsClient as IsoGitFsApi } from 'isomorphic-git';

import {
  setUserInfo as setUserInfoInGit,
  VersionControlRepositoryErrorTag,
} from '../../../../../../modules/infrastructure/version-control';
import { RepositoryError, ValidationError } from '../../../errors';
import { type ProjectId } from '../../../models';
import { type ProjectStore } from '../../../ports';
import { ensureProjectIdIsFsPath } from './project-id';

type SetAuthorInfoArgs = Parameters<ProjectStore['setAuthorInfo']>[0];

export const ensureAuthTokenIsProvided: (
  authToken: string | undefined
) => Effect.Effect<string, ValidationError, never> = (authToken) =>
  pipe(
    Option.fromNullable(authToken),
    Option.match({
      onNone: () =>
        Effect.fail(
          new ValidationError(
            'Auth token must be provided to perform this operation'
          )
        ),
      onSome: (token) => Effect.succeed(token),
    })
  );

export const setAuthorInfo = ({
  isoGitFs,
  projectId,
  username,
  email,
}: {
  isoGitFs: IsoGitFsApi;
  projectId: ProjectId;
  username: SetAuthorInfoArgs['username'];
  email: SetAuthorInfoArgs['email'];
}): ReturnType<ProjectStore['setAuthorInfo']> =>
  pipe(
    ensureProjectIdIsFsPath(projectId),
    Effect.flatMap((projectPath) =>
      pipe(
        setUserInfoInGit({
          isoGitFs,
          dir: projectPath,
          username,
          email,
        }),
        Effect.catchTag(VersionControlRepositoryErrorTag, (err) =>
          Effect.fail(new RepositoryError(err.message))
        )
      )
    )
  );

type AuthOps = Pick<ProjectStore, 'setAuthorInfo'>;

export const createAuthOps = ({
  isoGitFs,
}: {
  isoGitFs: IsoGitFsApi;
}): AuthOps => {
  const setAuthorInfoOp: AuthOps['setAuthorInfo'] = ({
    projectId,
    username,
    email,
  }) => setAuthorInfo({ isoGitFs, projectId, username, email });

  return { setAuthorInfo: setAuthorInfoOp };
};
