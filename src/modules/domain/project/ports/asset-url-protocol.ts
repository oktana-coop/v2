import * as Effect from 'effect/Effect';

import { type ValidationError } from '../errors';
import { type ProjectId, type ProjectRelPath } from '../models';

export type ParseProjectAssetUrlResult = {
  projectId: ProjectId;
  relPath: ProjectRelPath;
};

export type AssetUrlProtocol = {
  buildProjectAssetUrl: (args: {
    projectId: ProjectId;
    relPath: ProjectRelPath;
  }) => Effect.Effect<string, never, never>;
  parseProjectAssetUrl: (
    url: string
  ) => Effect.Effect<ParseProjectAssetUrlResult, ValidationError, never>;
};
