import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import { useCallback, useContext } from 'react';

import {
  type ProjectRelPath,
  resolveDocumentAssetUrl,
} from '../../../../../modules/domain/project';
import { parseDocumentAssetSrcEffect } from '../../../../../modules/domain/rich-text';
import { InfrastructureAdaptersContext } from '../../infrastructure-adapters/context';
import { ProjectContext } from '../context';

// Resolves a document's asset `src` values to renderable URLs. Asset srcs are
// document-relative, so resolution needs the path of the document being
// rendered.
export const useAssetSrcResolver = ({
  docPath,
}: {
  docPath: ProjectRelPath;
}) => {
  const { projectId } = useContext(ProjectContext);
  const { assetUrlProtocol } = useContext(InfrastructureAdaptersContext);

  return useCallback(
    (src: string) => {
      if (!projectId) {
        console.error('useAssetSrcResolver called without a current project.');
        return src;
      }

      return Effect.runSync(
        pipe(
          parseDocumentAssetSrcEffect(src),
          Effect.flatMap((parsedSrc) =>
            resolveDocumentAssetUrl({
              buildProjectAssetUrl: assetUrlProtocol.buildProjectAssetUrl,
            })({ src: parsedSrc, docPath, projectId })
          ),
          // A malformed src (empty, leading slash, etc.) shouldn't crash the editor render.
          // Hand it back untouched so the browser shows a broken image instead.
          Effect.orElseSucceed(() => src)
        )
      );
    },
    [assetUrlProtocol, docPath, projectId]
  );
};
