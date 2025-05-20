import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import { ipcRenderer } from 'electron';

import { type TaggedError } from '../../../utils/effect';
import { mapErrorTo } from '../../../utils/errors';

export const runPromiseSerializingErrorsForIPC = <A, E extends TaggedError>(
  effect: Effect.Effect<A, E, never>
): Promise<A> =>
  Effect.runPromise(
    pipe(
      effect,
      // Errors thrown through handle in the main process are not transparent as they are serialized
      // and only the message property from the original error is provided to the renderer process.
      // https://github.com/electron/electron/issues/24427
      // This is a workaround that embeds the tag in the error message,
      // so that we can reconstruct the typed error when deserializing it.
      Effect.catchAll((error) =>
        Effect.fail(
          new Error(`${error.message}; Typed Error Tag: ${error._tag}`)
        )
      )
    )
  );

const extractTypedErrorTag = (message: string): string | null => {
  const match = message.match(/Typed Error Tag:\s*([\w]+)/);
  return match ? match[1] : null;
};

const stripTypedErrorTag = (message: string): string => {
  return message.replace(/; Typed Error Tag:\s*[\w]+/, '');
};

type ErrorClass<E extends TaggedError> = new (message: string) => E;

export type ErrorRegistry<E extends TaggedError> = Record<
  string,
  ErrorClass<E>
>;

const deserializeError = <E extends TaggedError>(
  err: Error,
  registry: ErrorRegistry<E>,
  mapUnknownErrorTo: ErrorClass<E>
): E => {
  // Errors thrown through handle in the main process are not transparent as they are serialized
  // and only the message property from the original error is provided to the renderer process.
  // https://github.com/electron/electron/issues/24427
  // This is a workaround that extracts the tag from the error message and reconstructs the typed error.
  const tag = extractTypedErrorTag(err.message);
  if (tag) {
    err.message = stripTypedErrorTag(err.message);
  }

  const errorType = tag && registry[tag] ? registry[tag] : mapUnknownErrorTo;
  const error = mapErrorTo(errorType, 'Error in Electron IPC message')(err);

  return error;
};

export const invokeEffect =
  <E extends TaggedError>(
    errorRegistry: ErrorRegistry<E>,
    mapUnknownErrorTo: ErrorClass<E>
  ) =>
  <A>(channel: string, ...args: unknown[]): Effect.Effect<A, E, never> => {
    return pipe(
      Effect.tryPromise({
        try: () => ipcRenderer.invoke(channel, ...args),
        catch: (err: unknown) => {
          const typedError =
            err instanceof Error
              ? deserializeError(err, errorRegistry, mapUnknownErrorTo)
              : mapErrorTo(
                  mapUnknownErrorTo,
                  'Error in Electron IPC message'
                )(err);

          console.log(typedError);
          console.log(typedError._tag);
          throw typedError;
        },
      })
    );
  };
