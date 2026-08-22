import * as Effect from 'effect/Effect';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { describe, expect, it, vi } from 'vitest';

import { subscribeToRef } from '../../../../../utils/effect';
import {
  CURRENT_SCHEMA_VERSION,
  type RichTextDocument,
} from '../../models/document';
import { PRIMARY_RICH_TEXT_REPRESENTATION } from '../../models/representation';
import { type ConvergentDocumentState } from '../../ports/convergent-document';
import { createAdapter } from '.';

const markdownDocument = (content: string): RichTextDocument => ({
  schemaVersion: CURRENT_SCHEMA_VERSION,
  representation: PRIMARY_RICH_TEXT_REPRESENTATION,
  content,
});

// Changes arrive asynchronously on a subscriber Effect fiber; the tests observe
// from outside the Effect runtime, so they wait on conditions via vi.waitFor
// (which retries the assertion until it passes or times out).
describe('in-memory live document adapter', () => {
  it('bumps the version and holds the new content on change', async () => {
    const live = await Effect.runPromise(createAdapter('initial'));

    const version = await Effect.runPromise(live.change('edited'));

    const current = await Effect.runPromise(SubscriptionRef.get(live.content));

    expect(version).toBe('1');
    expect(current).toEqual({
      doc: markdownDocument('edited'),
      version: '1',
    });
  });

  it('does not produce a new value or bump the version for equal content', async () => {
    const live = await Effect.runPromise(createAdapter('initial'));

    const received: ConvergentDocumentState[] = [];
    const unsubscribe = subscribeToRef(live.content, (change) =>
      received.push(change)
    );
    // The replayed current value proves the subscription is live.
    await vi.waitFor(() => expect(received).toHaveLength(1));

    const version = await Effect.runPromise(live.change('initial'));
    // Sentinel: deliveries are ordered, so had the equal change produced a
    // new value, it would occupy the second slot instead of the sentinel.
    await Effect.runPromise(live.change('sentinel'));
    await vi.waitFor(() => expect(received).toHaveLength(2));

    expect(version).toBe('0');
    expect(received).toEqual([
      { doc: markdownDocument('initial'), version: '0' },
      { doc: markdownDocument('sentinel'), version: '1' },
    ]);

    unsubscribe();
  });

  it('replays the current value to a subscriber, then every change', async () => {
    const live = await Effect.runPromise(createAdapter('initial'));

    const received: ConvergentDocumentState[] = [];
    const unsubscribe = subscribeToRef(live.content, (change) =>
      received.push(change)
    );
    await vi.waitFor(() => expect(received).toHaveLength(1));

    expect(received).toEqual([
      { doc: markdownDocument('initial'), version: '0' },
    ]);

    await Effect.runPromise(live.change('first'));
    await Effect.runPromise(live.change('second'));
    await vi.waitFor(() => expect(received).toHaveLength(3));

    expect(received).toEqual([
      { doc: markdownDocument('initial'), version: '0' },
      { doc: markdownDocument('first'), version: '1' },
      { doc: markdownDocument('second'), version: '2' },
    ]);

    unsubscribe();
  });
});
