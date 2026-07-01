import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import { type PromiseFsClient as IsoGitFsApi } from 'isomorphic-git';

import {
  abortMerge as abortGitMerge,
  commitMergeConflictsResolution as commitMergeConflictsResolutionToGit,
  getMergeConflictInfo as getGitRepoMergeConflictInfo,
  removeFile as removeFileFromGit,
  stageFile as stageFileInGit,
  VersionControlRepositoryErrorTag,
} from '../../../../../../modules/infrastructure/version-control';
import { RepositoryError } from '../../../errors';
import { type ProjectStore } from '../../../ports';
import { extractArtifactRelativePathFromId } from './artifacts';
import { ensureProjectIdIsFsPath } from './project-id';

type MergingOps = Pick<
  ProjectStore,
  | 'getMergeConflictInfo'
  | 'abortMerge'
  | 'resolveConflictByKeepingDocument'
  | 'resolveConflictByDeletingDocument'
  | 'commitMergeConflictsResolution'
>;

export const createMergingOps = ({
  isoGitFs,
}: {
  isoGitFs: IsoGitFsApi;
}): MergingOps => {
  const getMergeConflictInfo: MergingOps['getMergeConflictInfo'] = ({
    projectId,
  }) =>
    pipe(
      ensureProjectIdIsFsPath(projectId),
      Effect.flatMap((projectPath) =>
        pipe(
          getGitRepoMergeConflictInfo({
            isoGitFs,
            dir: projectPath,
          }),
          Effect.catchTag(VersionControlRepositoryErrorTag, (err) =>
            Effect.fail(new RepositoryError(err.message))
          )
        )
      )
    );

  const abortMerge: MergingOps['abortMerge'] = ({ projectId }) =>
    pipe(
      ensureProjectIdIsFsPath(projectId),
      Effect.flatMap((projectPath) =>
        pipe(
          abortGitMerge({
            isoGitFs,
            dir: projectPath,
          }),
          Effect.catchTag(VersionControlRepositoryErrorTag, (err) =>
            Effect.fail(new RepositoryError(err.message))
          )
        )
      )
    );

  const resolveConflictByKeepingDocument: MergingOps['resolveConflictByKeepingDocument'] =
    ({ projectId, documentId }) =>
      Effect.Do.pipe(
        Effect.bind('projectPath', () => ensureProjectIdIsFsPath(projectId)),
        Effect.bind('documentPath', () =>
          extractArtifactRelativePathFromId(documentId)
        ),
        Effect.flatMap(({ projectPath, documentPath }) =>
          pipe(
            stageFileInGit({
              isoGitFs,
              dir: projectPath,
              path: documentPath,
            }),
            Effect.catchTag(VersionControlRepositoryErrorTag, (err) =>
              Effect.fail(new RepositoryError(err.message))
            )
          )
        )
      );

  const resolveConflictByDeletingDocument: MergingOps['resolveConflictByDeletingDocument'] =
    ({ projectId, documentId }) =>
      Effect.Do.pipe(
        Effect.bind('projectPath', () => ensureProjectIdIsFsPath(projectId)),
        Effect.bind('documentPath', () =>
          extractArtifactRelativePathFromId(documentId)
        ),
        Effect.flatMap(({ projectPath, documentPath }) =>
          pipe(
            removeFileFromGit({
              isoGitFs,
              dir: projectPath,
              path: documentPath,
            }),
            Effect.catchTag(VersionControlRepositoryErrorTag, (err) =>
              Effect.fail(new RepositoryError(err.message))
            )
          )
        )
      );

  const commitMergeConflictsResolution: MergingOps['commitMergeConflictsResolution'] =
    ({ projectId, message }) =>
      pipe(
        ensureProjectIdIsFsPath(projectId),
        Effect.flatMap((projectPath) =>
          pipe(
            commitMergeConflictsResolutionToGit({
              isoGitFs,
              dir: projectPath,
              message,
            }),
            Effect.catchTag(VersionControlRepositoryErrorTag, (err) =>
              Effect.fail(new RepositoryError(err.message))
            )
          )
        )
      );

  return {
    getMergeConflictInfo,
    abortMerge,
    resolveConflictByKeepingDocument,
    resolveConflictByDeletingDocument,
    commitMergeConflictsResolution,
  };
};
