import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import { useContext } from 'react';
import { useNavigate } from 'react-router';

import { urlEncodeProjectId } from '../../../../modules/domain/project';
import {
  type ChangeId,
  createGitBlobRef,
  isGitCommitHash,
  UNCOMMITTED_CHANGE_ID,
  urlEncodeArtifactId,
  urlEncodeChangeId,
} from '../../../../modules/infrastructure/version-control';
import { MultiDocumentProjectContext } from '../../app-state';

export const useProjectHistoryDocumentSelection = () => {
  const { projectId, versionedProjectStore } = useContext(
    MultiDocumentProjectContext
  );
  const navigate = useNavigate();

  return async (path: string, changeId?: ChangeId) => {
    if (!projectId || !versionedProjectStore) return;

    const resolvedChangeId = changeId ?? UNCOMMITTED_CHANGE_ID;

    // Resolve the artifact ID for this document. When the document was
    // deleted in this commit, the store lookup will fail with NotFoundError.
    // Fall back to constructing the blob ref directly so the history view
    // can still display the deletion.
    const artifactId = await Effect.runPromise(
      pipe(
        versionedProjectStore.findDocumentInProject({
          projectId,
          documentPath: path,
          changeId: resolvedChangeId,
        }),
        Effect.catchTag('VersionedProjectNotFoundError', () =>
          isGitCommitHash(resolvedChangeId)
            ? Effect.succeed(createGitBlobRef({ ref: resolvedChangeId, path }))
            : Effect.fail(
                new Error(
                  `Document "${path}" not found and change ID is not a commit hash`
                )
              )
        )
      )
    );

    const url = `/projects/${urlEncodeProjectId(projectId)}/history/${urlEncodeArtifactId(artifactId)}/changes/${urlEncodeChangeId(resolvedChangeId)}`;

    navigate(url);
  };
};
