import * as Cause from 'effect/Cause';
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
        Effect.fail(new Error(`${error._tag}: ${error.message}}`))
      )
    )
  );

type ErrorClass<E extends Cause.YieldableError> = new (message: string) => E;

export type ErrorRegistry<E extends Cause.YieldableError> = Record<
  string,
  ErrorClass<E>
>;

const deserializeError = <E extends Cause.YieldableError>(
  err: Error,
  registry: ErrorRegistry<E>,
  mapUnknownErrorTo: ErrorClass<E>
): E => {
  const messageParts = err.message.split(':');
  const tag = messageParts[0];
  const message = messageParts.slice(1).join(':').trim();

  const ConcreteErrorClass =
    registry[tag] || mapErrorTo(mapUnknownErrorTo)('An unknown error occurred');
  return Object.assign(new ConcreteErrorClass(message), err);
};

type SerializedError = {
  cause: {
    failure: {
      message: string;
      _tag: string;
    };
  };
};

const isSerializedError = (obj: unknown): obj is SerializedError =>
  typeof obj === 'object' &&
  obj !== null &&
  'cause' in obj &&
  typeof obj.cause === 'object' &&
  obj.cause !== null &&
  'failure' in obj.cause &&
  typeof obj.cause.failure === 'object' &&
  obj.cause.failure !== null &&
  '_tag' in obj.cause.failure &&
  typeof obj.cause.failure._tag === 'string' &&
  'message' in obj.cause.failure &&
  typeof obj.cause.failure.message === 'string';

export const invokeEffect =
  <E extends Cause.YieldableError>(
    errorRegistry: ErrorRegistry<E>,
    mapUnknownErrorTo: ErrorClass<E>
  ) =>
  <A>(channel: string, ...args: unknown[]): Effect.Effect<A, E, never> =>
    Effect.tryPromise({
      try: () => ipcRenderer.invoke(channel, ...args),
      catch: (err: unknown) =>
        err instanceof Error
          ? deserializeError(err, errorRegistry, mapUnknownErrorTo)
          : mapErrorTo(mapUnknownErrorTo)('An unknown error occurred'),
    });
