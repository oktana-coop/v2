import * as Cause from 'effect/Cause';

export class RepositoryError extends Cause.YieldableError {
  readonly _tag = 'VersionedProjectRepositoryError';
}

export class NotFoundError extends Cause.YieldableError {
  readonly _tag = 'VersionedProjectNotFoundError';
}

export class MissingProjectMetadataError extends Cause.YieldableError {
  readonly _tag = 'VersionedProjectMissingProjectMetadataError';
}

export class DataIntegrityError extends Cause.YieldableError {
  readonly _tag = 'VersionedProjectDataIntegrityError';
}

export class ValidationError extends Cause.YieldableError {
  readonly _tag = 'VersionedProjectValidationError';
}
