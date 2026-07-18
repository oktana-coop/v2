import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as Option from 'effect/Option';
import { useCallback, useContext } from 'react';

import { insertAsset } from '../../../../../modules/domain/project';
import { type DocumentAsset } from '../../../../../modules/domain/rich-text';
import { type ArtifactId } from '../../../../../modules/infrastructure/version-control';
import { InfrastructureAdaptersContext } from '../../infrastructure-adapters/context';
import { ProjectContext } from '../context';
import { useCurrentArtifactId } from '../current-artifact/use-current-artifact-id';

export const useAssetInsertion = (
  documentIdOverride?: ArtifactId
): (() => Promise<DocumentAsset | null>) => {
  const { projectId, projectStore, refreshDirectoryTree } =
    useContext(ProjectContext);
  const { filesystem } = useContext(InfrastructureAdaptersContext);
  const currentArtifactId = useCurrentArtifactId();

  const documentId = documentIdOverride ?? currentArtifactId;

  return useCallback(async (): Promise<DocumentAsset | null> => {
    if (!projectId || !projectStore) {
      throw new Error('Cannot insert asset: no current project.');
    }
    if (!documentId) {
      throw new Error('Cannot insert asset: no current document.');
    }

    const src = await Effect.runPromise(
      pipe(
        insertAsset({
          openFile: filesystem.openFile,
          readBinaryFile: filesystem.readBinaryFile,
          lookupAssetByName: projectStore.lookupAssetByName,
          addAssetToProject: projectStore.addAssetToProject,
          getProjectRelativePath: projectStore.getProjectRelativePath,
          getArtifactPathById: projectStore.getArtifactPathById,
          assetsDirName: projectStore.assetsDirName,
        })({ projectId, documentId }),
        Effect.map(Option.getOrNull)
      )
    );

    // Picker was cancelled.
    if (!src) return null;

    await refreshDirectoryTree();

    return {
      src,
      // No default alt/caption — an asset only gets one when the user authors
      // it, so implicit figures stay caption-less.
      alt: null,
      title: null,
    };
  }, [projectId, projectStore, filesystem, documentId, refreshDirectoryTree]);
};
