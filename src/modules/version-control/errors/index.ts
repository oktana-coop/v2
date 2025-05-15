import * as Cause from 'effect/Cause';

export class RepositoryError extends Cause.YieldableError {
  readonly _tag = 'RepositoryError';
}

export class NotFoundError extends Cause.YieldableError {
  readonly _tag = 'NotFoundError';
}

export class DataIntegrityError extends Cause.YieldableError {
  readonly _tag = 'DataIntegrityError';
}
