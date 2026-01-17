import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import { type TaggedError } from '../../../../utils/effect';
import { mapErrorTo } from '../../../../utils/errors';
import { type IPCResult, isErrorResult, type SerializableError } from './types';

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
            data: error.data,
          },
        })
      )
    )
  );

type ErrorClass<E extends TaggedError> = new (
  message: string,
  data?: unknown
) => E;

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
    mapUnknownErrorTo?: ErrorClass<E>
  ) =>
  <A>(promise: Promise<IPCResult<A>>): Effect.Effect<A, E, never> =>
    Effect.tryPromise({
      try: async () => {
        const res = await promise;

        if (isErrorResult(res)) {
          throw res.error;
        }

        return res.result;
      },
      catch: (err: unknown) => {
        if (isSerializableError(err) && mapUnknownErrorTo) {
          const typedError = deserializeError(
            err,
            errorRegistry,
            mapUnknownErrorTo
          );

          return typedError;
        }

        throw err;
      },
    });

export * from './types';
