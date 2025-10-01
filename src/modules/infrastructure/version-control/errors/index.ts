import * as Cause from 'effect/Cause';

export class RepositoryError extends Cause.YieldableError {
  readonly _tag = 'VersionControlRepositoryError';
}

export class NotFoundError extends Cause.YieldableError {
  readonly _tag = 'VersionControlNotFoundError';
}

export class MigrationError extends Cause.YieldableError {
  readonly _tag = 'VersionControlMigrationError';
}
