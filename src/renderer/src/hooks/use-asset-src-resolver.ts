import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import { useCallback, useContext } from 'react';

import {
  parseProjectRelPath,
  resolveDocumentAssetUrl,
} from '../../../modules/domain/project';
import { parseDocumentAssetSrcEffect } from '../../../modules/domain/rich-text';
import { InfrastructureAdaptersContext, ProjectContext } from '../app-state';

// Resolves a document's asset `src` values to renderable URLs. Asset srcs are
// document-relative, so resolution needs the path of the doc being rendered.
// By default that's the currently-selected file; callers rendering a different
// document (e.g. a specific merge conflict) pass `docPathOverride`.
export const useAssetSrcResolver = (docPathOverride?: string) => {
  const { projectId, selectedFileInfo } = useContext(ProjectContext);
  const { assetUrlProtocol } = useContext(InfrastructureAdaptersContext);

  const rawDocPath = docPathOverride ?? selectedFileInfo?.path;
  const docPath = rawDocPath ? parseProjectRelPath(rawDocPath) : null;

  return useCallback(
    (src: string) => {
      if (!projectId) {
        throw new Error(
          'useAssetSrcResolver called without a current project.'
        );
      }

      if (!docPath) {
        throw new Error('useAssetSrcResolver called without a doc path.');
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
