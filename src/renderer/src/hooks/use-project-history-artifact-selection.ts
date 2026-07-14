import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import { useContext } from 'react';
import { useNavigate } from 'react-router';

import {
  inferArtifactTypeFromExtension,
  urlEncodeProjectId,
} from '../../../modules/domain/project';
import {
  type ArtifactId,
  type ChangeId,
  isCommitId,
  UNCOMMITTED_CHANGE_ID,
  urlEncodeArtifactId,
  urlEncodeChangeId,
  versionedArtifactTypes,
} from '../../../modules/infrastructure/version-control';
import { ProjectContext } from '../app-state';

export const useProjectHistoryArtifactSelection = () => {
  const { projectId, projectStore, currentBranch } = useContext(ProjectContext);
  const navigate = useNavigate();

  return async (path: string, changeId?: ChangeId) => {
    if (!projectId || !projectStore) return;

    const resolvedChangeId = changeId ?? UNCOMMITTED_CHANGE_ID;

    const resolveArtifactId = async (): Promise<ArtifactId> => {
      if (
        inferArtifactTypeFromExtension(path) !==
        versionedArtifactTypes.RICH_TEXT_DOCUMENT
      ) {
        const ref = isCommitId(resolvedChangeId)
          ? resolvedChangeId
          : currentBranch;

        if (!ref) {
          throw new Error(
            'Could not select asset because the current branch is not known'
          );
        }

        return Effect.runPromise(
          projectStore.lookupArtifactByPath({ projectId, path, ref })
        );
      }

      // Resolve the artifact ID for this document. When the document was
      // deleted in this commit, the store lookup will fail with NotFoundError.
      // Fall back to a store-minted id at this commit so the history view can
      // still display the deletion.
      return Effect.runPromise(
        pipe(
          projectStore.lookupDocumentInProject({
            projectId,
            documentPath: path,
            changeId: resolvedChangeId,
          }),
          Effect.catchTag('VersionedProjectNotFoundError', () =>
            isCommitId(resolvedChangeId)
              ? projectStore.lookupArtifactByPath({
                  projectId,
                  path,
                  ref: resolvedChangeId,
                })
              : Effect.fail(
                  new Error(
                    `Document "${path}" not found in the uncommitted working tree`
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
