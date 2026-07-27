import * as Effect from 'effect/Effect';
import * as Fiber from 'effect/Fiber';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';

export type Unsubscribe = () => void;

// Delivers the current value first (the replay), then every change, until the
// returned function unsubscribes.
export const subscribeToRef = <A>(
  ref: SubscriptionRef.SubscriptionRef<A>,
  onValue: (value: A) => void
): Unsubscribe => {
  const fiber = Effect.runFork(
    Stream.runForEach(ref.changes, (value) => Effect.sync(() => onValue(value)))
  );

  return () => {
    Effect.runFork(Fiber.interrupt(fiber));
  };
};
