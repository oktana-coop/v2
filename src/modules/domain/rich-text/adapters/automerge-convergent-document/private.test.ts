// The full build initializes the WebAssembly the slim build (used by the code
// under test) needs. In the app that is `createAutomergeRepo`'s job.
import '@automerge/automerge';

import { Repo } from '@automerge/automerge-repo/slim';
import * as Effect from 'effect/Effect';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { describe, expect, it, vi } from 'vitest';

import { createPrivateConvergentDocument } from './private';

describe('private convergent document', () => {
  it('starts a private document from what the store holds', async () => {
    const repo = new Repo({ network: [] });

    const document = await Effect.runPromise(
      createPrivateConvergentDocument({
        privateRepo: Effect.succeed(repo),
        initialText: 'fresh from disk',
        onError: vi.fn(),
      })
    );

    const state = await Effect.runPromise(
      SubscriptionRef.get(document.content)
    );
    expect(state.doc.content).toBe('fresh from disk');
  });
});
