import * as Effect from 'effect/Effect';
import * as Fiber from 'effect/Fiber';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';

export const subscribeToRef = <A>(
  ref: SubscriptionRef.SubscriptionRef<A>,
  onValue: (value: A) => void
): (() => void) => {
  const fiber = Effect.runFork(
    Stream.runForEach(ref.changes, (value) => Effect.sync(() => onValue(value)))
  );

  return () => {
    Effect.runFork(Fiber.interrupt(fiber));
  };
};
