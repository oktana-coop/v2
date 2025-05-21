import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import { ipcRenderer } from 'electron';

import { type TaggedError } from '../../../utils/effect';
import { mapErrorTo } from '../../../utils/errors';

type IPCResult<A> = {
  result?: A;
  error?: SerializableError;
};

type SerializableError = {
  message: string;
  tag: string;
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

export const invokeEffect =
  <E extends TaggedError>(
    errorRegistry: ErrorRegistry<E>,
    mapUnknownErrorTo: ErrorClass<E>
  ) =>
  <A>(channel: string, ...args: unknown[]): Effect.Effect<A, E, never> =>
    pipe(
      Effect.tryPromise({
        try: async () => {
          const res = await ipcRenderer.invoke(channel, ...args);

          if (res.error) {
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
