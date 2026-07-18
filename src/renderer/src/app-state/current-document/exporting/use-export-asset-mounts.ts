import * as Effect from 'effect/Effect';
import { useCallback, useContext } from 'react';

import { type ReferencedAsset } from '../../../../../modules/domain/project';
import { type RepresentationTransformAssetFile } from '../../../../../modules/domain/rich-text';
import { getParentPath } from '../../../../../modules/infrastructure/filesystem';
import { ProjectContext } from '../../current-project/context';
import { useArtifactPath } from '../../current-project/current-artifact/artifact-path';
import { useCurrentArtifactId } from '../../current-project/current-artifact/use-current-artifact-id';

export type ExportAssetMounts = {
  assetFiles: RepresentationTransformAssetFile[];
  resourcePath?: string;
};

export const emptyExportAssetMounts: ExportAssetMounts = {
  assetFiles: [],
  resourcePath: undefined,
};

// Gathers the assets a document references — their project-relative paths and
// bytes — plus the document's directory (the resource path), for the
// representation transform to embed.
export const useExportAssetMounts = () => {
  const { projectId, projectStore } = useContext(ProjectContext);
  const currentArtifactId = useCurrentArtifactId();
  const { path: docPath } = useArtifactPath(currentArtifactId);

  return useCallback(async (): Promise<ExportAssetMounts> => {
    if (!projectId || !docPath) {
      return emptyExportAssetMounts;
    }

    const readReferencedAssets = (): Promise<ReferencedAsset[]> =>
      projectStore && currentArtifactId
        ? Effect.runPromise(
            projectStore.readDocumentReferencedAssets({
              projectId,
              documentId: currentArtifactId,
            })
          )
        : Promise.resolve([]);

    // A failed read shouldn't break the export; degrade to no mounts.
    const referencedAssets = await readReferencedAssets().catch(() => []);

    if (referencedAssets.length === 0) {
      return emptyExportAssetMounts;
    }

    const assetFiles = referencedAssets.map(({ relPath, bytes }) => ({
      relativePath: relPath,
      bytes,
    }));

    return { assetFiles, resourcePath: getParentPath(docPath) };
  }, [projectId, docPath, projectStore, currentArtifactId]);
};
