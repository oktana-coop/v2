import * as Cause from 'effect/Cause';

export const AuthValidationErrorTag = 'AuthValidationError';
export class ValidationError extends Cause.YieldableError {
  readonly _tag = AuthValidationErrorTag;
}
