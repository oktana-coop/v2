import * as Effect from 'effect/Effect';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { describe, expect, it } from 'vitest';

import { subscribeToRef } from './subscribe-to-ref';

// Subscriptions deliver on a fiber, so let the scheduler run before asserting.
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('subscribeToRef', () => {
  it('replays the current value, streams updates, and stops on unsubscribe', async () => {
    const ref = await Effect.runPromise(SubscriptionRef.make('initial'));

    const received: string[] = [];
    const unsubscribe = subscribeToRef(ref, (value) => received.push(value));
    await settle();

    expect(received).toEqual(['initial']);

    await Effect.runPromise(SubscriptionRef.set(ref, 'updated'));
    await settle();

    expect(received).toEqual(['initial', 'updated']);

    unsubscribe();
    await settle();

    await Effect.runPromise(SubscriptionRef.set(ref, 'after unsubscribe'));
    await settle();

    expect(received).toEqual(['initial', 'updated']);
  });
});
