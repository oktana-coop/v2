import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import {
  type Filesystem,
  type RepositoryError as FilesystemRepositoryError,
} from '../../../../../../modules/infrastructure/filesystem';
import {
  type ArtifactId,
  createGitBlobRef,
  decomposeGitRef,
  type GitRef,
  isGitRef,
} from '../../../../../../modules/infrastructure/version-control';
import { mapErrorTo } from '../../../../../../utils/errors';
import { ValidationError } from '../../../errors';
import {
  inferArtifactKindFromExtension,
  parseProjectRelPathEffect,
  type ProjectRelPath,
} from '../../../models';
import { type ProjectStore } from '../../../ports';

export const ensureArtifactIdIsGitRef: (
  id: ArtifactId
) => Effect.Effect<GitRef, ValidationError, never> = (id) =>
  pipe(
    Effect.succeed(id),
    Effect.filterOrFail(
      isGitRef,
      (val) => new ValidationError(`Invalid artifact id: ${val}`)
    )
  );

export const extractArtifactRelativePathFromId: (
  id: ArtifactId
) => Effect.Effect<ProjectRelPath, ValidationError, never> = (id) =>
  pipe(
    ensureArtifactIdIsGitRef(id),
    Effect.flatMap((gitRef) =>
      parseProjectRelPathEffect(decomposeGitRef(gitRef).path)
    )
  );

export const getArtifactMetaDataById: ProjectStore['getArtifactMetaDataById'] =
  ({ artifactId }) =>
    pipe(
      extractArtifactRelativePathFromId(artifactId),
      Effect.map((path) => ({
        id: artifactId,
        path,
        kind: inferArtifactKindFromExtension(path),
      }))
    );

export const lookupArtifactByPath: ProjectStore['lookupArtifactByPath'] = ({
  path,
  ref,
}) =>
  Effect.try({
    try: () => createGitBlobRef({ ref, path }),
    catch: mapErrorTo(ValidationError, 'Cannot build artifact id for path'),
  });

// Resolves an artifact id (blob or tree ref) to its absolute workdir path.
export const resolveAbsolutePath = ({
  filesystem,
  projectDir,
  artifactId,
}: {
  filesystem: Filesystem;
  projectDir: string;
  artifactId: ArtifactId;
}): Effect.Effect<string, ValidationError | FilesystemRepositoryError> =>
  pipe(
    extractArtifactRelativePathFromId(artifactId),
    Effect.flatMap((relPath) =>
      filesystem.getAbsolutePath({ path: relPath, dirPath: projectDir })
    )
  );
