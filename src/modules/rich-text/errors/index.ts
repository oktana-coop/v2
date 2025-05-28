import * as Cause from 'effect/Cause';

export class RepositoryError extends Cause.YieldableError {
  readonly _tag = 'VersionedDocumentStoreError';
}

export class NotFoundError extends Cause.YieldableError {
  readonly _tag = 'VersionedDocumentNotFoundError';
}
