import * as Cause from 'effect/Cause';

export const SyncServiceErrorTag = 'SyncServiceError';
export class SyncServiceError extends Cause.YieldableError {
  readonly _tag = SyncServiceErrorTag;
}
