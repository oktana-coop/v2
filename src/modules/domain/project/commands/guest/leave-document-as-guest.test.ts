import * as Effect from 'effect/Effect';
import { describe, expect, it } from 'vitest';

import { leaveDocumentAsGuest } from './leave-document-as-guest';

describe('leaveDocumentAsGuest', () => {
  it('forgets the share, closes the document, then releases it', async () => {
    const calls: string[] = [];

    await Effect.runPromise(
      leaveDocumentAsGuest({
        liveDocument: {
          close: Effect.sync(() => {
            calls.push('close');
          }),
        },
        forgetShare: () => calls.push('forget'),
        leaveSharedDocument: ({ shareId }) =>
          Effect.sync(() => {
            calls.push(`release:${shareId}`);
          }),
      })('automerge:url')
    );

    expect(calls).toEqual(['forget', 'close', 'release:automerge:url']);
  });
});
