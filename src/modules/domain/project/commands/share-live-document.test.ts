import * as Effect from 'effect/Effect';
import { describe, expect, it, vi } from 'vitest';

import { RepositoryError } from '../errors';
import { joinSharedDocument } from './join-shared-document';
import { leaveSharedDocument } from './leave-shared-document';
import { shareLiveDocument } from './share-live-document';

describe('shareLiveDocument', () => {
  it('mints the live content, attaches it, and remembers the share', async () => {
    const calls: string[] = [];
    const rememberShare = vi.fn((url: string) => {
      calls.push(`remember:${url}`);
    });

    const url = await Effect.runPromise(
      shareLiveDocument({
        readLiveContent: Effect.succeed('what the editor shows'),
        shareDocument: ({ content }) =>
          Effect.sync(() => {
            calls.push(`mint:${content}`);
            return 'automerge:url';
          }),
        attachSharedDocument: (shareUrl) =>
          Effect.sync(() => {
            calls.push(`attach:${shareUrl}`);
          }),
        rememberShare,
      })
    );

    expect(url).toBe('automerge:url');
    expect(calls).toEqual([
      'mint:what the editor shows',
      'attach:automerge:url',
      'remember:automerge:url',
    ]);
  });

  it('remembers nothing when attaching fails', async () => {
    const rememberShare = vi.fn();

    const failure = await Effect.runPromise(
      Effect.flip(
        shareLiveDocument({
          readLiveContent: Effect.succeed('content'),
          shareDocument: () => Effect.succeed('automerge:url'),
          attachSharedDocument: () =>
            Effect.fail(new RepositoryError('unreachable')),
          rememberShare,
        })
      )
    );

    expect(failure).toBeInstanceOf(RepositoryError);
    expect(rememberShare).not.toHaveBeenCalled();
  });
});

describe('joinSharedDocument', () => {
  it('attaches the share, then remembers it', async () => {
    const calls: string[] = [];

    await Effect.runPromise(
      joinSharedDocument({
        attachSharedDocument: (shareUrl) =>
          Effect.sync(() => {
            calls.push(`attach:${shareUrl}`);
          }),
        rememberShare: (url) => {
          calls.push(`remember:${url}`);
        },
      })('automerge:pasted')
    );

    expect(calls).toEqual([
      'attach:automerge:pasted',
      'remember:automerge:pasted',
    ]);
  });

  it('remembers nothing when attaching fails', async () => {
    const rememberShare = vi.fn();

    await Effect.runPromise(
      Effect.flip(
        joinSharedDocument({
          attachSharedDocument: () =>
            Effect.fail(new RepositoryError('unreachable')),
          rememberShare,
        })('automerge:pasted')
      )
    );

    expect(rememberShare).not.toHaveBeenCalled();
  });
});

describe('leaveSharedDocument', () => {
  it('forgets, detaches to a private document, then releases the share', async () => {
    const calls: string[] = [];

    await Effect.runPromise(
      leaveSharedDocument({
        forgetShare: () => {
          calls.push('forget');
        },
        detachToPrivate: Effect.sync(() => {
          calls.push('detach');
        }),
        leaveSharedDocument: ({ shareUrl }) =>
          Effect.sync(() => {
            calls.push(`release:${shareUrl}`);
          }),
      })('automerge:url')
    );

    expect(calls).toEqual(['forget', 'detach', 'release:automerge:url']);
  });
});
