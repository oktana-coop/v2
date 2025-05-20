import * as Cause from 'effect/Cause';

export class RepositoryError extends Cause.YieldableError {
  readonly _tag = 'FilesystemRepositoryError';
}

export class NotFoundError extends Cause.YieldableError {
  readonly _tag = 'FilesystemNotFoundError';
}

export class AbortError extends Cause.YieldableError {
  readonly _tag = 'FilesystemAbortError';
}

export class DataIntegrityError extends Cause.YieldableError {
  readonly _tag = 'FileystemDataIntegrityError';
}

export class AccessControlError extends Cause.YieldableError {
  readonly _tag = 'FilesystemAccessControlError';
}

export const errorRegistry = {
  RepositoryError,
  NotFoundError,
  AbortError,
  DataIntegrityError,
  AccessControlError,
} as const;

export type FilesystemError =
  | RepositoryError
  | NotFoundError
  | AbortError
  | DataIntegrityError
  | AccessControlError;
