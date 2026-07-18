import * as Effect from 'effect/Effect';
import { useEffect } from 'react';
import { useNavigate } from 'react-router';

import { urlEncodeProjectId } from '../../../../../modules/domain/project';
import {
  type ArtifactId,
  urlEncodeArtifactId,
} from '../../../../../modules/infrastructure/version-control';
import { type ProjectContextType, type ProjectStateSetters } from '../types';

type CurrentArtifactDeps = Pick<
  ProjectContextType,
  | 'projectId'
  | 'projectStore'
  | 'currentBranch'
  | 'mergeConflictInfo'
  | 'pulledUpstreamChanges'
  | 'findDocumentInProject'
> &
  Pick<ProjectStateSetters, 'setPulledUpstreamChanges'> & {
    currentArtifactId: ArtifactId | null;
  };

// Keeps the current artifact ID valid, reacting to events like branch switches
// and pulling remote changes.
export const useCurrentArtifactSync = ({
  projectId,
  projectStore,
  currentBranch,
  mergeConflictInfo,
  pulledUpstreamChanges,
  findDocumentInProject,
  currentArtifactId,
  setPulledUpstreamChanges,
}: CurrentArtifactDeps): void => {
  const navigate = useNavigate();

  useEffect(() => {
    if (
      !projectId ||
      !projectStore ||
      !currentArtifactId ||
      mergeConflictInfo
    ) {
      return;
    }

    let cancelled = false;

    const navigateToProjectsList = () => {
      setPulledUpstreamChanges(false);
      navigate(`/projects`);
    };

    // Re-resolve the open artifact against the store's current branch and follow
    // it there, or reset if it can't be resolved.
    const reloadSelectedDocumentOrReset = async () => {
      try {
        const selectedFilePath = await Effect.runPromise(
          projectStore.getArtifactPathById({
            projectId,
            artifactId: currentArtifactId,
          })
        );

        const doc = await findDocumentInProject({
          projectId,
          documentPath: selectedFilePath,
        });

        if (cancelled) return;
        setPulledUpstreamChanges(false);
        navigate(
          `/projects/${urlEncodeProjectId(projectId)}/artifacts/${urlEncodeArtifactId(doc.id)}`
        );
      } catch {
        if (cancelled) return;
        // TODO: Only do this on NotFoundError.
        navigateToProjectsList();
      }
    };

    reloadSelectedDocumentOrReset();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBranch, pulledUpstreamChanges, mergeConflictInfo]);

  useEffect(() => {
    if (currentArtifactId) {
      window.electronAPI.sendCurrentDocumentId(currentArtifactId);
    }
  }, [currentArtifactId]);
};
