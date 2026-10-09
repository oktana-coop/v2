import * as Cause from 'effect/Cause';

export const PlainTextValidationErrorTag = 'PlainTextValidationError';
export class ValidationError extends Cause.YieldableError {
  readonly _tag = PlainTextValidationErrorTag;
}
