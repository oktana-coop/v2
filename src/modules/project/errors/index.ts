import * as Cause from 'effect/Cause';

export class StoreError extends Cause.YieldableError {
  readonly _tag = 'VersionedProjectStoreError';
}

export class NotFoundError extends Cause.YieldableError {
  readonly _tag = 'VersionedProjectNotFoundError';
}

export class MissingIndexFileError extends Cause.YieldableError {
  readonly _tag = 'VersionedProjectMissingIndexFileError';
}

export class DataIntegrityError extends Cause.YieldableError {
  readonly _tag = 'VersionedProjectDataIntegrityError';
}
