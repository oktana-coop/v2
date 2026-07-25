import * as Effect from 'effect/Effect';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { describe, expect, it } from 'vitest';

import { subscribeToRef } from '../../../../../utils/effect';
import {
  CURRENT_SCHEMA_VERSION,
  type RichTextDocument,
} from '../../models/document';
import { richTextRepresentations } from '../../models/representation';
import { type LiveDocumentChange } from '../../ports/live-document';
import { createAdapter } from '.';

const markdownDocument = (content: string): RichTextDocument => ({
  schemaVersion: CURRENT_SCHEMA_VERSION,
  representation: richTextRepresentations.MARKDOWN,
  content,
});

// Subscriptions deliver on a fiber, so let the scheduler run before asserting.
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('in-memory live document adapter', () => {
  it('bumps the version and holds the new content on change', async () => {
    const live = await Effect.runPromise(
      createAdapter(markdownDocument('initial'))
    );

    const version = await Effect.runPromise(
      live.change(markdownDocument('edited'))
    );

    const current = await Effect.runPromise(SubscriptionRef.get(live.content));

    expect(version).toBe('1');
    expect(current).toEqual({
      doc: markdownDocument('edited'),
      version: '1',
    });
  });

  it('does not emit or bump the version for equal content', async () => {
    const live = await Effect.runPromise(
      createAdapter(markdownDocument('initial'))
    );

    const received: LiveDocumentChange[] = [];
    const unsubscribe = subscribeToRef(live.content, (change) =>
      received.push(change)
    );
    await settle();

    const version = await Effect.runPromise(
      live.change(markdownDocument('initial'))
    );
    await settle();

    expect(version).toBe('0');
    expect(received).toHaveLength(1);

    unsubscribe();
  });

  it('replays the current value to a subscriber, then every change', async () => {
    const live = await Effect.runPromise(
      createAdapter(markdownDocument('initial'))
    );

    const received: LiveDocumentChange[] = [];
    const unsubscribe = subscribeToRef(live.content, (change) =>
      received.push(change)
    );
    await settle();

    expect(received).toEqual([
      { doc: markdownDocument('initial'), version: '0' },
    ]);

    await Effect.runPromise(live.change(markdownDocument('first')));
    await settle();
    await Effect.runPromise(live.change(markdownDocument('second')));
    await settle();

    expect(received).toEqual([
      { doc: markdownDocument('initial'), version: '0' },
      { doc: markdownDocument('first'), version: '1' },
      { doc: markdownDocument('second'), version: '2' },
    ]);

    unsubscribe();
  });
});
