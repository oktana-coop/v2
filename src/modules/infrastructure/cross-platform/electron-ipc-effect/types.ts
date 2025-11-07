import * as Effect from 'effect/Effect';

export type SerializableError = {
  message: string;
  tag: string;
};

export type IPCResult<A> =
  | {
      result: A;
    }
  | { error: SerializableError };

export type PromisifyEffects<T> = {
  [K in keyof T]: T[K] extends (
    ...args: infer Args
  ) => Effect.Effect<infer A, unknown, unknown>
    ? (...args: Args) => Promise<IPCResult<A>>
    : never;
};

export const isErrorResult = <A>(
  result: IPCResult<A>
): result is { error: SerializableError } => {
  return 'error' in result;
};

export type AppendParam<F, P> = F extends (...args: infer A) => infer R
  ? (...args: [...A, P]) => R
  : never;
