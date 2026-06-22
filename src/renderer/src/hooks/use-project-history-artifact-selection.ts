import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import { useContext } from 'react';
import { useNavigate } from 'react-router';

import {
  inferArtifactTypeFromExtension,
  urlEncodeProjectId,
} from '../../../modules/domain/project';
import {
  type ChangeId,
  createGitBlobRef,
  isGitCommitHash,
  type ResolvedArtifactId,
  UNCOMMITTED_CHANGE_ID,
  urlEncodeArtifactId,
  urlEncodeChangeId,
  versionedArtifactTypes,
} from '../../../modules/infrastructure/version-control';
import { ProjectContext } from '../app-state';

export const useProjectHistoryArtifactSelection = () => {
  const { projectId, versionedProjectStore, currentBranch } =
    useContext(ProjectContext);
  const navigate = useNavigate();

  return async (path: string, changeId?: ChangeId) => {
    if (!projectId || !versionedProjectStore) return;

    const resolvedChangeId = changeId ?? UNCOMMITTED_CHANGE_ID;

    const resolveArtifactId = async (): Promise<ResolvedArtifactId> => {
      if (
        inferArtifactTypeFromExtension(path) !==
        versionedArtifactTypes.RICH_TEXT_DOCUMENT
      ) {
        const ref = isGitCommitHash(resolvedChangeId)
          ? resolvedChangeId
          : currentBranch;

        if (!ref) {
          throw new Error(
            'Could not select asset because the current branch is not known'
          );
        }

        return createGitBlobRef({ ref, path });
      }

      // Resolve the artifact ID for this document. When the document was
      // deleted in this commit, the store lookup will fail with NotFoundError.
      // Fall back to constructing the blob ref directly so the history view
      // can still display the deletion.
      return Effect.runPromise(
        pipe(
          versionedProjectStore.findDocumentInProject({
            projectId,
            documentPath: path,
            changeId: resolvedChangeId,
          }),
          Effect.catchTag('VersionedProjectNotFoundError', () =>
            isGitCommitHash(resolvedChangeId)
              ? Effect.succeed(
                  createGitBlobRef({ ref: resolvedChangeId, path })
                )
              : Effect.fail(
                  new Error(
                    `Document "${path}" not found and change ID is not a commit hash`
                  )
                )
          )
        )
      );
    };

    const artifactId = await resolveArtifactId();

    const url = `/projects/${urlEncodeProjectId(projectId)}/history/${urlEncodeArtifactId(artifactId)}/changes/${urlEncodeChangeId(resolvedChangeId)}`;

    navigate(url);
  };
};
