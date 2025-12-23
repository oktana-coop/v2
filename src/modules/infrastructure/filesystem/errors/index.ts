import * as Cause from 'effect/Cause';

export const FilesystemRepositoryErrorTag = 'FilesystemRepositoryError';
export class RepositoryError extends Cause.YieldableError {
  readonly _tag = FilesystemRepositoryErrorTag;
}

export const FilesystemNotFoundErrorTag = 'FilesystemNotFoundError';
export class NotFoundError extends Cause.YieldableError {
  readonly _tag = FilesystemNotFoundErrorTag;
}

export const FilesystemAbortErrorTag = 'FilesystemAbortError';
export class AbortError extends Cause.YieldableError {
  readonly _tag = FilesystemAbortErrorTag;
}

export const FilesystemDataIntegrityErrorTag = 'FilesystemDataIntegrityError';
export class DataIntegrityError extends Cause.YieldableError {
  readonly _tag = FilesystemDataIntegrityErrorTag;
}

export const FilesystemAccessControlErrorTag = 'FilesystemAccessControlError';
export class AccessControlError extends Cause.YieldableError {
  readonly _tag = FilesystemAccessControlErrorTag;
}
