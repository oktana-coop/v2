import * as Cause from 'effect/Cause';

export class RepositoryError extends Cause.YieldableError {
  readonly _tag = 'VersionedDocumentRepositoryError';
}

export class NotFoundError extends Cause.YieldableError {
  readonly _tag = 'VersionedDocumentNotFoundError';
}

export class RepresentationTransformError extends Cause.YieldableError {
  readonly _tag = 'VersionedDocumentRepresentationTransformError';
}

export class ValidationError extends Cause.YieldableError {
  readonly _tag = 'VersionedDocumentValidationError';
}
