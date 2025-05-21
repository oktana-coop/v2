import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import { type TaggedError } from '../../../utils/effect';
import { mapErrorTo } from '../../../utils/errors';

type IPCResult<A> =
  | {
      result: A;
    }
  | { error: SerializableError };

type SerializableError = {
  message: string;
  tag: string;
};

const isErrorResult = <A>(
  result: IPCResult<A>
): result is { error: SerializableError } => {
  return 'error' in result;
};

const isSerializableError = (error: unknown): error is SerializableError => {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    'tag' in error &&
    typeof (error as SerializableError).message === 'string' &&
    typeof (error as SerializableError).tag === 'string'
  );
};

export const runPromiseSerializingErrorsForIPC = <A, E extends TaggedError>(
  effect: Effect.Effect<A, E, never>
): Promise<IPCResult<A>> =>
  Effect.runPromise(
    pipe(
      effect,
      Effect.flatMap((result) => Effect.succeed({ result })),
      // Errors thrown through handle in the main process are not transparent as they are serialized
      // and only the message property from the original error is provided to the renderer process.
      // https://github.com/electron/electron/issues/24427
      // This is a workaround that embeds the tag in the error message,
      // so that we can reconstruct the typed error when deserializing it.
      Effect.catchAll((error) =>
        Effect.succeed({
          error: {
            message: error.message,
            tag: error._tag,
          },
        })
      )
    )
  );

type ErrorClass<E extends TaggedError> = new (message: string) => E;

export type ErrorRegistry<E extends TaggedError> = Record<
  string,
  ErrorClass<E>
>;

export const deserializeError = <E extends TaggedError>(
  err: SerializableError,
  registry: ErrorRegistry<E>,
  mapUnknownErrorTo: ErrorClass<E>
): E => {
  // Errors thrown through handle in the main process are not transparent as they are serialized
  // and only the message property from the original error is provided to the renderer process.
  // https://github.com/electron/electron/issues/24427
  // This is a workaround that extracts the tag from the error message and reconstructs the typed error.
  const tag = err.tag;

  const errorType = tag && registry[tag] ? registry[tag] : mapUnknownErrorTo;
  const error = mapErrorTo(errorType, 'Error in Electron IPC message')(err);

  return error;
};

export const effectifyIPCPromise =
  <E extends TaggedError>(
    errorRegistry: ErrorRegistry<E>,
    mapUnknownErrorTo: ErrorClass<E>
  ) =>
  <A>(promise: Promise<IPCResult<A>>): Effect.Effect<A, E, never> =>
    pipe(
      Effect.tryPromise({
        try: async () => {
          const res = await promise;

          if (isErrorResult(res)) {
            throw res.error;
          }

          return res.result;
        },
        catch: (err: unknown) => {
          if (isSerializableError(err)) {
            const typedError = deserializeError(
              err,
              errorRegistry,
              mapUnknownErrorTo
            );

            console.log(typedError);

            return typedError;
          }

          throw err;
        },
      }),
      Effect.catchAll((err) => {
        console.log('In invokeEffect error handler', err);
        return Effect.fail(err);
      })
    );

type ExtractEffectArgs<EffectFn> = EffectFn extends (
  ...args: infer A
) => Effect.Effect<unknown, unknown, unknown>
  ? A
  : never;
type ExtractEffectSuccess<EffectFn> = EffectFn extends (
  ...args: unknown[]
) => Effect.Effect<infer A, unknown, unknown>
  ? A
  : never;
type ExtractEffectError<EffectFn> = EffectFn extends (
  ...args: unknown[]
) => Effect.Effect<unknown, infer E, unknown>
  ? E
  : never;

/**
 * Wrap a single IPC Promise-returning function back into an Effect,
 * typed with the original Effect's success and error types.
 */
export function effectifyIPCPromiseFn<
  EffectFn extends (
    ...args: unknown[]
  ) => Effect.Effect<unknown, unknown, unknown>,
  E extends TaggedError,
>(
  promiseFn: (
    ...args: ExtractEffectArgs<EffectFn>
  ) => Promise<IPCResult<ExtractEffectSuccess<EffectFn>>>,
  effectFn: EffectFn,
  errorRegistry: ErrorRegistry<E>,
  mapUnknownErrorTo: ErrorClass<E>
): (
  ...args: ExtractEffectArgs<EffectFn>
) => Effect.Effect<
  ExtractEffectSuccess<EffectFn>,
  ExtractEffectError<EffectFn> & E,
  never
> {
  return (...args: ExtractEffectArgs<EffectFn>) =>
    pipe(
      effectifyIPCPromise(errorRegistry, mapUnknownErrorTo)(promiseFn(...args)),
      Effect.mapError((err) => err as ExtractEffectError<EffectFn> & E)
    );
}
