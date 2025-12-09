import * as Cause from 'effect/Cause';

export const VersionedDocumentRepositoryErrorTag =
  'VersionedDocumentRepositoryError';
export class RepositoryError extends Cause.YieldableError {
  readonly _tag = VersionedDocumentRepositoryErrorTag;
}

export const VersionedDocumentNotFoundErrorTag =
  'VersionedDocumentNotFoundError';
export class NotFoundError extends Cause.YieldableError {
  readonly _tag = VersionedDocumentNotFoundErrorTag;
}

export const VersionedDocumentRepresentationTransformErrorTag =
  'VersionedDocumentRepresentationTransformError';
export class RepresentationTransformError extends Cause.YieldableError {
  readonly _tag = VersionedDocumentRepresentationTransformErrorTag;
}

export const VersionedDocumentValidationErrorTag =
  'VersionedDocumentValidationError';
export class ValidationError extends Cause.YieldableError {
  readonly _tag = VersionedDocumentValidationErrorTag;
}
