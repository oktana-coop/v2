import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { describe, expect, it, vi } from 'vitest';

import {
  forEachLatestRefChange,
  runOnLatestRefChange,
  subscribeToRef,
  subscribeToRefChanges,
} from './subscribe-to-ref';

describe('subscribeToRef', () => {
  it('replays the current value, streams updates, and stops on unsubscribe', async () => {
    const ref = await Effect.runPromise(SubscriptionRef.make('initial'));

    const received: string[] = [];
    const unsubscribe = subscribeToRef(ref, (value) => received.push(value));

    await vi.waitFor(() => expect(received).toEqual(['initial']));

    await Effect.runPromise(SubscriptionRef.set(ref, 'updated'));
    await vi.waitFor(() => expect(received).toEqual(['initial', 'updated']));

    unsubscribe();
    await Effect.runPromise(SubscriptionRef.set(ref, 'after unsubscribe'));

    // Nothing positive to wait for here — a value must NOT arrive. Give any
    // stray delivery a chance to happen, then assert it didn't.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(received).toEqual(['initial', 'updated']);
  });
});

describe('subscribeToRefChanges', () => {
  it('skips the replay, streams updates, and stops on unsubscribe', async () => {
    const ref = await Effect.runPromise(SubscriptionRef.make('initial'));

    const received: string[] = [];
    const unsubscribe = subscribeToRefChanges(ref, (value) =>
      received.push(value)
    );

    await Effect.runPromise(SubscriptionRef.set(ref, 'updated'));
    // Deliveries are ordered, so had the replay been delivered, it would
    // precede 'updated'.
    await vi.waitFor(() => expect(received).toEqual(['updated']));

    unsubscribe();
    await Effect.runPromise(SubscriptionRef.set(ref, 'after unsubscribe'));

    // A value must NOT arrive after unsubscribe; give any stray delivery a
    // chance, then assert it didn't.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(received).toEqual(['updated']);
  });
});

describe('forEachLatestRefChange', () => {
  it('replays the current value, runs the handler per change, and stops on unsubscribe', async () => {
    const ref = await Effect.runPromise(SubscriptionRef.make('initial'));

    const handled: string[] = [];
    const unsubscribe = forEachLatestRefChange(ref, (value) =>
      Effect.sync(() => {
        handled.push(value);
      })
    );

    await vi.waitFor(() => expect(handled).toEqual(['initial']));

    await Effect.runPromise(SubscriptionRef.set(ref, 'updated'));
    await vi.waitFor(() => expect(handled).toEqual(['initial', 'updated']));

    unsubscribe();
    await Effect.runPromise(SubscriptionRef.set(ref, 'after unsubscribe'));

    // A value must NOT arrive after unsubscribe; give any stray delivery a
    // chance, then assert it didn't.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(handled).toEqual(['initial', 'updated']);
  });

  it('never runs handlers concurrently', async () => {
    const ref = await Effect.runPromise(SubscriptionRef.make(0));

    let active = 0;
    let maxActive = 0;
    const handled: number[] = [];

    const unsubscribe = forEachLatestRefChange(ref, (value) =>
      pipe(
        Effect.sync(() => {
          active += 1;
          maxActive = Math.max(maxActive, active);
        }),
        Effect.flatMap(() => Effect.sleep('20 millis')),
        Effect.flatMap(() =>
          Effect.sync(() => {
            active -= 1;
            handled.push(value);
          })
        )
      )
    );

    for (const n of [1, 2, 3]) {
      await Effect.runPromise(SubscriptionRef.set(ref, n));
    }

    await vi.waitFor(() => expect(handled).toContain(3));
    expect(maxActive).toBe(1);

    unsubscribe();
  });

  it('collapses a burst of changes to the latest while the handler is busy', async () => {
    const ref = await Effect.runPromise(SubscriptionRef.make(0));

    // A slow handler lets later changes pile up while one is in flight.
    const handled: number[] = [];
    const unsubscribe = forEachLatestRefChange(ref, (value) =>
      pipe(
        Effect.sleep('30 millis'),
        Effect.flatMap(() =>
          Effect.sync(() => {
            handled.push(value);
          })
        )
      )
    );

    for (const n of [1, 2, 3, 4, 5]) {
      await Effect.runPromise(SubscriptionRef.set(ref, n));
    }

    // The handler converges on the newest value, and the intermediates were
    // dropped rather than handled one-by-one.
    await vi.waitFor(() => expect(handled[handled.length - 1]).toBe(5));
    expect(handled.length).toBeLessThanOrEqual(2);

    unsubscribe();
  });
});

describe('runOnLatestRefChange', () => {
  it('runs for the current value, runs per change, and stops on unsubscribe', async () => {
    const ref = await Effect.runPromise(SubscriptionRef.make('initial'));

    const seen: string[] = [];
    const unsubscribe = runOnLatestRefChange(
      ref,
      pipe(
        SubscriptionRef.get(ref),
        Effect.map((value) => {
          seen.push(value);
        })
      )
    );

    await vi.waitFor(() => expect(seen).toEqual(['initial']));

    await Effect.runPromise(SubscriptionRef.set(ref, 'updated'));
    await vi.waitFor(() => expect(seen).toEqual(['initial', 'updated']));

    unsubscribe();
    await Effect.runPromise(SubscriptionRef.set(ref, 'after unsubscribe'));

    // A run must NOT happen after unsubscribe; give any stray one a chance,
    // then assert it didn't.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(seen).toEqual(['initial', 'updated']);
  });

  it('collapses a burst into one run that sees the newest value', async () => {
    const ref = await Effect.runPromise(SubscriptionRef.make(0));

    // A slow run lets later changes pile up while it is in flight; the run
    // reads the ref only at its end.
    const seen: number[] = [];
    const unsubscribe = runOnLatestRefChange(
      ref,
      pipe(
        Effect.sleep('30 millis'),
        Effect.flatMap(() => SubscriptionRef.get(ref)),
        Effect.map((value) => {
          seen.push(value);
        })
      )
    );

    for (const n of [1, 2, 3, 4, 5]) {
      await Effect.runPromise(SubscriptionRef.set(ref, n));
    }

    // Every run sees the newest value, and the intermediates never got a run
    // of their own.
    await vi.waitFor(() => expect(seen[seen.length - 1]).toBe(5));
    expect(seen.every((value) => value === 5)).toBe(true);
    expect(seen.length).toBeLessThanOrEqual(2);

    unsubscribe();
  });
});
