import { Repo } from '@automerge/automerge-repo';
import * as Effect from 'effect/Effect';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { describe, expect, it } from 'vitest';

import { createPrivateConvergentDocument } from './private';

describe('private convergent document', () => {
  it('starts a private document from what the store holds', async () => {
    const repo = new Repo({ network: [] });

    const document = await Effect.runPromise(
      createPrivateConvergentDocument({
        privateRepo: Effect.succeed(repo),
        initialText: 'fresh from disk',
      })
    );

    const state = await Effect.runPromise(
      SubscriptionRef.get(document.content)
    );
    expect(state.doc.content).toBe('fresh from disk');
  });
});
