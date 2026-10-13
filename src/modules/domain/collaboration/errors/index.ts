import * as Cause from 'effect/Cause';

export const ConvergentDocumentUnavailableErrorTag =
  'ConvergentDocumentUnavailableError';
export class ConvergentDocumentUnavailableError extends Cause.YieldableError {
  readonly _tag = ConvergentDocumentUnavailableErrorTag;
}

export const ConvergentDocumentChangeErrorTag = 'ConvergentDocumentChangeError';
export class ConvergentDocumentChangeError extends Cause.YieldableError {
  readonly _tag = ConvergentDocumentChangeErrorTag;
}

export const SharedDocumentUnavailableErrorTag =
  'SharedDocumentUnavailableError';
export class SharedDocumentUnavailableError extends Cause.YieldableError {
  readonly _tag = SharedDocumentUnavailableErrorTag;
}

// A shared document written in a format version this app does not implement.
export const UnsupportedDocumentFormatErrorTag =
  'UnsupportedDocumentFormatError';
export class UnsupportedDocumentFormatError extends Cause.YieldableError {
  readonly _tag = UnsupportedDocumentFormatErrorTag;
}

// A share holding another kind of document than the one asked for.
export const UnexpectedDocumentKindErrorTag = 'UnexpectedDocumentKindError';
export class UnexpectedDocumentKindError extends Cause.YieldableError {
  readonly _tag = UnexpectedDocumentKindErrorTag;
}

// The editor's edits could not be turned into document content.
export const LocalEditsContributionErrorTag = 'LocalEditsContributionError';
export class LocalEditsContributionError extends Cause.YieldableError {
  readonly _tag = LocalEditsContributionErrorTag;
}

export const CollaborationValidationErrorTag = 'CollaborationValidationError';
export class ValidationError extends Cause.YieldableError {
  readonly _tag = CollaborationValidationErrorTag;
}
