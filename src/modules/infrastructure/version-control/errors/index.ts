import * as Cause from 'effect/Cause';

import { MergeConflictInfo } from '../models';

export const VersionControlRepositoryErrorTag = 'VersionControlRepositoryError';
export class RepositoryError extends Cause.YieldableError {
  readonly _tag = VersionControlRepositoryErrorTag;
}

export const VersionControlNotFoundErrorTag = 'VersionControlNotFoundError';
export class NotFoundError extends Cause.YieldableError {
  readonly _tag = VersionControlNotFoundErrorTag;
}

export const VersionControlMigrationErrorTag = 'VersionControlMigrationError';
export class MigrationError extends Cause.YieldableError {
  readonly _tag = VersionControlMigrationErrorTag;
}

export const VersionControlValidationErrorTag = 'VersionControlValidationError';
export class ValidationError extends Cause.YieldableError {
  readonly _tag = VersionControlValidationErrorTag;
}

export const VersionControlMergeConflictErrorTag =
  'VersionControlMergeConflictError';
export class MergeConflictError extends Cause.YieldableError {
  readonly _tag = VersionControlMergeConflictErrorTag;
  readonly data;

  constructor(message: string, data: MergeConflictInfo) {
    super(message);
    this.data = data;
  }
}

export const VersionControlDeletedDocumentErrorTag =
  'VersionControlDeletedDocumentError';
export class DeletedDocumentError extends Cause.YieldableError {
  readonly _tag = VersionControlDeletedDocumentErrorTag;
  readonly data;

  constructor(message: string, data: { parentCommitId: string | null }) {
    super(message);
    this.data = data;
  }
}

export const VersionControlSyncProviderErrorTag =
  'VersionControlSyncProviderError';
export class SyncProviderError extends Cause.YieldableError {
  readonly _tag = VersionControlSyncProviderErrorTag;
}
