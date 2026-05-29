import * as Effect from 'effect/Effect';
import { useCallback, useContext } from 'react';

import {
  parseProjectRelPath,
  resolveDocumentAssetUrl,
} from '../../../modules/domain/project';
import { parseDocumentAssetSrc } from '../../../modules/domain/rich-text';
import {
  InfrastructureAdaptersContext,
  MultiDocumentProjectContext,
} from '../app-state';
import { useProjectId } from './use-project-id';

export const useAssetSrcResolver = () => {
  const projectId = useProjectId();
  const { selectedFileInfo } = useContext(MultiDocumentProjectContext);
  const { assetUrlProtocol } = useContext(InfrastructureAdaptersContext);
  const docPath = selectedFileInfo?.path
    ? parseProjectRelPath(selectedFileInfo.path)
    : null;

  return useCallback(
    (src: string) => {
      if (!projectId) {
        throw new Error(
          'useAssetSrcResolver called without a current project.'
        );
      }
      if (!docPath) {
        // TODO: wire the single-doc project's doc path through this hook so
        // single-doc projects don't trip this branch.
        throw new Error('useAssetSrcResolver called without a doc path.');
      }
      return Effect.runSync(
        resolveDocumentAssetUrl({
          buildProjectAssetUrl: assetUrlProtocol.buildProjectAssetUrl,
        })({
          src: parseDocumentAssetSrc(src),
          docPath,
          projectId,
        })
      );
    },
    [assetUrlProtocol, docPath, projectId]
  );
};
