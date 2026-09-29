import * as Effect from 'effect/Effect';
import * as Fiber from 'effect/Fiber';
import * as Stream from 'effect/Stream';

import { type Unsubscribe } from './subscribe-to-ref';

// Delivers every value the stream emits, until the returned function
// unsubscribes.
export const subscribeToStream = <A>(
  stream: Stream.Stream<A>,
  onValue: (value: A) => void
): Unsubscribe => {
  const fiber = Effect.runFork(
    Stream.runForEach(stream, (value) => Effect.sync(() => onValue(value)))
  );

  return () => {
    Effect.runFork(Fiber.interrupt(fiber));
  };
};
