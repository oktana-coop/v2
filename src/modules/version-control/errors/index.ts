import * as Cause from 'effect/Cause';

export class RepositoryError extends Cause.YieldableError {
  readonly _tag = 'RepositoryError';
}

export type NotFoundError = Cause.NoSuchElementException;
