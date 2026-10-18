import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import { type PromiseFsClient as IsoGitFsApi } from 'isomorphic-git';

import {
  getBranchCommitHistory,
  getChangedFilesForCommit,
  getUncommittedFileChanges,
  isGitCommitHash,
  isUncommittedChangeId,
  VersionControlNotFoundErrorTag,
  VersionControlRepositoryErrorTag,
} from '../../../../../../modules/infrastructure/version-control';
import {
  NotFoundError,
  RepositoryError,
  ValidationError,
} from '../../../errors';
import { type ProjectStore } from '../../../ports';
import { ensureProjectIdIsFsPath } from './project-id';

type HistoryOps = Pick<
  ProjectStore,
  'getProjectCommitHistory' | 'getChangedDocumentsAtChange'
>;

export const createHistoryOps = ({
  isoGitFs,
}: {
  isoGitFs: IsoGitFsApi;
}): HistoryOps => {
  const getProjectCommitHistory: HistoryOps['getProjectCommitHistory'] = ({
    projectId,
    branch,
    limit,
  }) =>
    pipe(
      ensureProjectIdIsFsPath(projectId),
      Effect.flatMap((projectPath) =>
        pipe(
          getBranchCommitHistory({
            isoGitFs,
            dir: projectPath,
            branch,
            limit,
          }),
          Effect.catchTag(VersionControlNotFoundErrorTag, (err) =>
            Effect.fail(new NotFoundError(err.message))
          ),
          Effect.catchTag(VersionControlRepositoryErrorTag, (err) =>
            Effect.fail(new RepositoryError(err.message))
          )
        )
      )
    );

  const getChangedDocumentsAtChange: HistoryOps['getChangedDocumentsAtChange'] =
    ({ projectId, changeId }) =>
      pipe(
        ensureProjectIdIsFsPath(projectId),
        Effect.flatMap((projectPath) =>
          isUncommittedChangeId(changeId)
            ? pipe(
                getUncommittedFileChanges({
                  isoGitFs,
                  dir: projectPath,
                }),
                Effect.catchTag(VersionControlRepositoryErrorTag, (err) =>
                  Effect.fail(new RepositoryError(err.message))
                )
              )
            : pipe(
                Effect.succeed(changeId),
                Effect.filterOrFail(
                  isGitCommitHash,
                  (val) =>
                    new ValidationError(`Invalid commit hash: ${String(val)}`)
                ),
                Effect.flatMap((commitHash) =>
                  getChangedFilesForCommit({
                    isoGitFs,
                    dir: projectPath,
                    commitId: commitHash,
                  })
                ),
                Effect.catchTag(VersionControlRepositoryErrorTag, (err) =>
                  Effect.fail(new RepositoryError(err.message))
                )
              )
        )
      );

  return { getProjectCommitHistory, getChangedDocumentsAtChange };
};
