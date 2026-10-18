import * as Effect from 'effect/Effect';

import { type ValidationError } from '../../../errors';
import { type ProjectFsPath, type ProjectId } from '../../../models';

// ProjectId is currently always a filesystem path (Git-coupled). See the
// VCS-agnostic IDs TODO in models/project-id.
export const ensureProjectIdIsFsPath: (
  projectId: ProjectId
) => Effect.Effect<ProjectFsPath, ValidationError, never> = (projectId) =>
  Effect.succeed(projectId);
