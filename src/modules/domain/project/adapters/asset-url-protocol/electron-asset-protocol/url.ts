import * as Effect from 'effect/Effect';

import { splitPosixPath } from '../../../../../infrastructure/filesystem';
import { ValidationError } from '../../../errors';
import {
  parseProjectRelPathEffect,
  type ProjectId,
  projectIdSchema,
  type ProjectRelPath,
} from '../../../models';
import { type ParseProjectAssetUrlResult } from '../../../ports/asset-url-protocol';

export const PROJECT_ASSET_SCHEME = 'project-asset';

// The projectId can't go in the hostname because it's typically an absolute filesystem path,
// and URL-encoded slashes are illegal for a `standard: true` privileged Electron scheme.
// The project ID becomes the first segment of the URL's path.
const HOST = 'project';

const encodePathSegments = (relPath: string) =>
  splitPosixPath(relPath).map(encodeURIComponent).join('/');

export const buildProjectAssetUrl = ({
  projectId,
  relPath,
}: {
  projectId: ProjectId;
  relPath: ProjectRelPath;
}): string =>
  `${PROJECT_ASSET_SCHEME}://${HOST}/${encodeURIComponent(projectId)}/${encodePathSegments(
    relPath
  )}`;

export const parseProjectAssetUrl = (
  url: string
): Effect.Effect<ParseProjectAssetUrlResult, ValidationError, never> => {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return Effect.fail(new ValidationError(`Malformed asset URL: ${url}`));
  }

  if (parsed.protocol !== `${PROJECT_ASSET_SCHEME}:`) {
    return Effect.fail(
      new ValidationError(`Unexpected asset URL scheme: ${parsed.protocol}`)
    );
  }
  if (parsed.hostname !== HOST) {
    return Effect.fail(
      new ValidationError(`Unexpected asset URL host: ${parsed.hostname}`)
    );
  }

  const path = parsed.pathname.replace(/^\/+/, '');
  const slashIndex = path.indexOf('/');
  if (slashIndex < 0) {
    return Effect.fail(
      new ValidationError('Asset URL is missing rel-path segment.')
    );
  }

  const projectIdResult = projectIdSchema.safeParse(
    decodeURIComponent(path.slice(0, slashIndex))
  );
  if (!projectIdResult.success) {
    return Effect.fail(
      new ValidationError('Asset URL contains an invalid projectId.')
    );
  }

  return Effect.map(
    parseProjectRelPathEffect(decodeURIComponent(path.slice(slashIndex + 1))),
    (relPath) => ({ projectId: projectIdResult.data, relPath })
  );
};
