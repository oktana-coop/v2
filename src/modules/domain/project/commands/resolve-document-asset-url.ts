import * as Effect from 'effect/Effect';

import {
  type DocumentAssetSrc,
  isAbsoluteAssetSrc,
} from '../../rich-text/models';
import {
  docRelToProjectRel,
  type ProjectId,
  type ProjectRelPath,
} from '../models';
import { type AssetUrlProtocol } from '../ports/asset-url-protocol';

export type ResolveDocumentAssetUrlDeps = {
  buildProjectAssetUrl: AssetUrlProtocol['buildProjectAssetUrl'];
};

export type ResolveDocumentAssetUrlArgs = {
  src: DocumentAssetSrc;
  docPath: ProjectRelPath;
  projectId: ProjectId;
};

export const resolveDocumentAssetUrl =
  ({ buildProjectAssetUrl }: ResolveDocumentAssetUrlDeps) =>
  ({
    src,
    docPath,
    projectId,
  }: ResolveDocumentAssetUrlArgs): Effect.Effect<string, never, never> =>
    isAbsoluteAssetSrc(src)
      ? Effect.succeed(src)
      : buildProjectAssetUrl({
          projectId,
          relPath: docRelToProjectRel({ docRel: src, docPath }),
        });
