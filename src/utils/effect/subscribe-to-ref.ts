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

// Like subscribeToRef, but without the replay: only changes made after
// subscribing are delivered.
export const subscribeToRefChanges = <A>(
  ref: SubscriptionRef.SubscriptionRef<A>,
  onValue: (value: A) => void
): Unsubscribe => {
  const fiber = Effect.runFork(
    Stream.runForEach(Stream.drop(ref.changes, 1), (value) =>
      Effect.sync(() => onValue(value))
    )
  );

  return () => {
    Effect.runFork(Fiber.interrupt(fiber));
  };
};

// Runs the handler Effect for the current value and every change, one at a
// time: the next change waits for the running handler to finish, so handling
// never overlaps. While the handler is busy, a burst of updates collapses to
// just the latest — the sliding buffer keeps only the newest and drops the
// rest. Stops when the returned function unsubscribes.
export const forEachLatestRefChange = <A>(
  ref: SubscriptionRef.SubscriptionRef<A>,
  onChange: (value: A) => Effect.Effect<unknown>
): Unsubscribe => {
  const fiber = Effect.runFork(
    Stream.runForEach(
      Stream.buffer(ref.changes, { capacity: 1, strategy: 'sliding' }),
      onChange
    )
  );

  return () => {
    Effect.runFork(Fiber.interrupt(fiber));
  };
};
