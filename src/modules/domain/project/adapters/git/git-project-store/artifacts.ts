import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import {
  decomposeGitBlobRef,
  type GitBlobRef,
  isGitBlobRef,
  type ResolvedArtifactId,
} from '../../../../../../modules/infrastructure/version-control';
import { ValidationError } from '../../../errors';
import {
  parseProjectRelPathEffect,
  type ProjectRelPath,
} from '../../../models';

export const ensureArtifactIdIsGitRef: (
  id: ResolvedArtifactId
) => Effect.Effect<GitBlobRef, ValidationError, never> = (id) =>
  pipe(
    Effect.succeed(id),
    Effect.filterOrFail(
      isGitBlobRef,
      (val) => new ValidationError(`Invalid document id: ${val}`)
    )
  );

export const extractArtifactRelativePathFromId: (
  id: ResolvedArtifactId
) => Effect.Effect<ProjectRelPath, ValidationError, never> = (id) =>
  pipe(
    ensureArtifactIdIsGitRef(id),
    Effect.flatMap((gitBlobRef) =>
      parseProjectRelPathEffect(decomposeGitBlobRef(gitBlobRef).path)
    )
  );
