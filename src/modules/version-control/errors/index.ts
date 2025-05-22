import * as Cause from 'effect/Cause';

export class RepositoryError extends Cause.YieldableError {
  readonly _tag = 'VersionControlRepositoryError';
}

export class NotFoundError extends Cause.YieldableError {
  readonly _tag = 'VersionControlNotFoundError';
}

export class MissingIndexFileError extends Cause.YieldableError {
  readonly _tag = 'VersionControlMissingIndexFileError';
}

export class DataIntegrityError extends Cause.YieldableError {
  readonly _tag = 'VersionControlDataIntegrityError';
}
