import * as Cause from 'effect/Cause';

export const isErrorLike = (err: unknown): err is Error => {
  return (
    typeof err === 'object' &&
    err !== null &&
    'message' in err &&
    typeof err.message === 'string'
  );
};

export function mapErrorTo<T extends Cause.YieldableError>(
  // Constructor signature (expecting something that can be instantiated with new, taking a message)
  ErrorClass: new (message: string) => T,
  fallbackMessage = 'An unknown error occurred'
): (err: unknown) => T {
  return (err: unknown) => {
    if (isErrorLike(err)) {
      return new ErrorClass(err.message);
    }
    return new ErrorClass(fallbackMessage);
  };
}
