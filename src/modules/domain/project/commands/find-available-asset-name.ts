import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import {
  getExtension,
  removeExtension,
} from '../../../../modules/infrastructure/filesystem';
import { MigrationError } from '../../../../modules/infrastructure/version-control';
import {
  NotFoundError as VersionedProjectNotFoundError,
  RepositoryError as VersionedProjectRepositoryError,
  ValidationError as VersionedProjectValidationError,
  VersionedProjectNotFoundErrorTag,
} from '../errors';
import { type ProjectId } from '../models';

// Structural shape of a store's `lookupAssetByName`. Both the multi- and
// single-document stores satisfy this, so the helper works for either.
type LookupAssetByName = (args: {
  projectId: ProjectId;
  name: string;
}) => Effect.Effect<
  unknown,
  | VersionedProjectValidationError
  | VersionedProjectRepositoryError
  | VersionedProjectNotFoundError
  | MigrationError,
  never
>;

export const findAvailableAssetName = ({
  projectId,
  desiredName,
  lookupAssetByName,
}: {
  projectId: ProjectId;
  desiredName: string;
  lookupAssetByName: LookupAssetByName;
}): Effect.Effect<
  string,
  | VersionedProjectValidationError
  | VersionedProjectRepositoryError
  | MigrationError,
  never
> => {
  const base = removeExtension(desiredName);
  const extension = getExtension(desiredName);
  const ext = extension ? `.${extension}` : '';

  const tryName = (
    name: string,
    attempt: number
  ): Effect.Effect<
    string,
    | VersionedProjectValidationError
    | VersionedProjectRepositoryError
    | MigrationError,
    never
  > =>
    // Inverted semantics: lookupAssetByName succeeding means a collision (an asset by
    // this name exists) and we must retry; failing with NotFound means the name is free.
    // So `flatMap` (success branch) recurses, and `catchTag` (failure branch) terminates.
    pipe(
      lookupAssetByName({ projectId, name }),
      Effect.flatMap(() => tryName(`${base}-${attempt}${ext}`, attempt + 1)),
      Effect.catchTag(VersionedProjectNotFoundErrorTag, () =>
        Effect.succeed(name)
      )
    );

  return tryName(desiredName, 1);
};
