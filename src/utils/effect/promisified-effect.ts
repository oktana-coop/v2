import { Effect } from 'effect';

/**
 * Turns a single `Effect` function into a Promise-returning function.
 */
type PromisifyEffectFn<F> = F extends (
  ...args: infer Args
) => Effect.Effect<infer A, unknown, unknown>
  ? (...args: Args) => Promise<A>
  : never;

/**
 * Recursively transform all methods in a record from `Effect` to `Promise`.
 */
export type PromisifyEffects<T> = {
  [K in keyof T]: T[K] extends (...args: unknown[]) => unknown
    ? PromisifyEffectFn<T[K]>
    : never;
};
