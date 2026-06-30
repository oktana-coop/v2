import * as Cause from 'effect/Cause';

export const VersionedProjectRepositoryErrorTag =
  'VersionedProjectRepositoryError';
export class RepositoryError extends Cause.YieldableError {
  readonly _tag = VersionedProjectRepositoryErrorTag;
}

export const VersionedProjectNotFoundErrorTag = 'VersionedProjectNotFoundError';
export class NotFoundError extends Cause.YieldableError {
  readonly _tag = VersionedProjectNotFoundErrorTag;
}

export const VersionedProjectMissingProjectMetadataErrorTag =
  'VersionedProjectMissingProjectMetadataError';
export class MissingProjectMetadataError extends Cause.YieldableError {
  readonly _tag = VersionedProjectMissingProjectMetadataErrorTag;
}

export const VersionedProjectDataIntegrityErrorTag =
  'VersionedProjectDataIntegrityError';
export class DataIntegrityError extends Cause.YieldableError {
  readonly _tag = VersionedProjectDataIntegrityErrorTag;
}

export const VersionedProjectValidationErrorTag =
  'VersionedProjectValidationError';
export class ValidationError extends Cause.YieldableError {
  readonly _tag = VersionedProjectValidationErrorTag;
}

export const VersionedProjectDeletedDocumentErrorTag =
  'VersionedProjectDeletedDocumentError';
export class DeletedDocumentError extends Cause.YieldableError {
  readonly _tag = VersionedProjectDeletedDocumentErrorTag;
  readonly data;

  constructor(message: string, data: { parentCommitId: string | null }) {
    super(message);
    this.data = data;
  }
}
