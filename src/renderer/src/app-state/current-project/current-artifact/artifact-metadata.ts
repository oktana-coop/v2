import * as Effect from 'effect/Effect';
import { useContext, useEffect, useMemo, useState } from 'react';

import {
  type ArtifactMetaData,
  findNodeById,
  type ProjectId,
  type ProjectStore,
  type ProjectTreeNode,
} from '../../../../../modules/domain/project';
import { type ArtifactId } from '../../../../../modules/infrastructure/version-control';
import { ProjectContext } from '../context';

export type UseArtifactMetaDataResult = {
  artifact: ArtifactMetaData | null;
  resolving: boolean;
};

// A resolution paired with the id it was made for. Keeping the two together is
// what lets `resolving` be derived during render rather than set from an
// effect, which would leave one render reporting the previous artifact as new.
type ArtifactResolution = {
  artifactId: ArtifactId | null;
  artifact: ArtifactMetaData | null;
};

const NOTHING_RESOLVED: ArtifactResolution = {
  artifactId: null,
  artifact: null,
};

// The project tree already carries every artifact's metadata, so reading it
// from there resolves synchronously — no render passes with a null artifact,
// which is what lets everything keyed off it survive a navigation intact.
export const useArtifactMetaDataFromTree = ({
  tree,
  artifactId,
}: {
  tree: ProjectTreeNode[];
  artifactId: ArtifactId | null;
}): ArtifactMetaData | null =>
  useMemo(
    () => (artifactId ? findNodeById({ tree, id: artifactId }) : null),
    [tree, artifactId]
  );

export const useResolveArtifactMetaData = ({
  projectId,
  projectStore,
  artifactId,
}: {
  projectId: ProjectId | null;
  projectStore: ProjectStore | null;
  artifactId: ArtifactId | null;
}): UseArtifactMetaDataResult => {
  const [resolution, setResolution] =
    useState<ArtifactResolution>(NOTHING_RESOLVED);

  useEffect(() => {
    if (!artifactId) {
      setResolution(NOTHING_RESOLVED);
      return;
    }

    // The project store isn't ready yet; leave the resolution untouched so
    // consumers keep reading this as loading rather than as "no artifact".
    if (!projectId || !projectStore) return;

    let cancelled = false;

    Effect.runPromise(
      projectStore.getArtifactMetaDataById({ projectId, artifactId })
    )
      .then((artifact) => {
        if (cancelled) return;
        setResolution({ artifactId, artifact });
      })
      .catch(() => {
        if (cancelled) return;
        setResolution({ artifactId, artifact: null });
      });

    return () => {
      cancelled = true;
    };
  }, [artifactId, projectId, projectStore]);

  const idAndArtifactInSync = resolution.artifactId === artifactId;

  return {
    artifact: idAndArtifactInSync ? resolution.artifact : null,
    resolving: artifactId !== null && !idAndArtifactInSync,
  };
};

export const useArtifactMetaData = (
  artifactId: ArtifactId | null
): UseArtifactMetaDataResult => {
  const { projectId, projectStore } = useContext(ProjectContext);

  return useResolveArtifactMetaData({ projectId, projectStore, artifactId });
};
