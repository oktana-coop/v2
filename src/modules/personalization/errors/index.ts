import * as Cause from 'effect/Cause';

export const PersonalizationValidationErrorTag =
  'PersonalizationValidationError';
export class ValidationError extends Cause.YieldableError {
  readonly _tag = PersonalizationValidationErrorTag;
}

export const StoreMigrationErrorTag = 'StoreMigrationError';
export class StoreMigrationError extends Cause.YieldableError {
  readonly _tag = StoreMigrationErrorTag;
}
