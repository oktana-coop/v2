import * as Effect from 'effect/Effect';
import { useContext } from 'react';

import { inferArtifactTypeFromExtension } from '../../../modules/domain/project';
import { versionedArtifactTypes } from '../../../modules/infrastructure/version-control';
import { ProjectContext } from '../app-state';
import { useNavigateToArtifact } from './use-navigate-to-artifact';

export const useArtifactSelection = () => {
  const { projectId, projectStore, currentBranch, findDocumentInProject } =
    useContext(ProjectContext);
  const navigateToArtifact = useNavigateToArtifact();

  return async (path: string) => {
    if (!projectId || !projectStore) {
      // TODO: Handle more gracefully
      throw new Error('Could not select file because no project was found');
    }

    if (
      inferArtifactTypeFromExtension(path) !==
      versionedArtifactTypes.RICH_TEXT_DOCUMENT
    ) {
      if (!currentBranch) {
        throw new Error(
          'Could not select file because the current branch is not known'
        );
      }

      const artifactId = await Effect.runPromise(
        projectStore.lookupArtifactByPath({
          projectId,
          path,
          ref: currentBranch,
        })
      );

      navigateToArtifact({ projectId, artifactId });
      return;
    }

    const resolvedDocument = await findDocumentInProject({
      projectId,
      documentPath: path,
    });

    if (!resolvedDocument) {
      // TODO: Handle more gracefully
      throw new Error(
        'Could not select file because the versioned document was not found in project'
      );
    }

    navigateToArtifact({
      projectId,
      artifactId: resolvedDocument.id,
    });
  };
};
