import * as Cause from 'effect/Cause';

export const AuthValidationErrorTag = 'AuthValidationError';
export class ValidationError extends Cause.YieldableError {
  readonly _tag = AuthValidationErrorTag;
}

export const SyncProviderAuthErrorTag = 'SyncProviderAuthError';
export class SyncProviderAuthError extends Cause.YieldableError {
  readonly _tag = SyncProviderAuthErrorTag;
}
