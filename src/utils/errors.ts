import * as Cause from 'effect/Cause';

export function mapErrorTo<T extends Cause.YieldableError>(
  // Constructor signature (expecting something that can be instantiated with new, taking a message)
  ErrorClass: new (message: string) => T,
  fallbackMessage = 'An unknown error occurred'
): (err: unknown) => T {
  return (err: unknown) => {
    if (err instanceof Error) {
      return new ErrorClass(err.message);
    }
    return new ErrorClass(fallbackMessage);
  };
}
