import * as Effect from 'effect/Effect';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { describe, expect, it, vi } from 'vitest';

import {
  CURRENT_SCHEMA_VERSION,
  type LiveDocument,
  type LiveDocumentChange,
  PRIMARY_RICH_TEXT_REPRESENTATION,
  SharedDocumentUnavailableError,
} from '../../../../modules/domain/rich-text';
import { joinSharedDocument } from './join-shared-document';
import { leaveSharedDocument } from './leave-shared-document';
import { shareLiveDocument } from './share-live-document';

// A live document that records what was asked of it, in order.
const createLiveDocument = async ({
  content = 'what the editor shows',
  calls = [],
  attachFails = false,
}: {
  content?: string;
  calls?: string[];
  attachFails?: boolean;
} = {}): Promise<LiveDocument> => {
  const contentRef = await Effect.runPromise(
    SubscriptionRef.make<LiveDocumentChange>({
      doc: {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        representation: PRIMARY_RICH_TEXT_REPRESENTATION,
        content,
      },
      version: '0',
    })
  );

  return {
    content: contentRef,
    change: () => Effect.succeed('0'),
    attachTo: (address) =>
      attachFails
        ? Effect.fail(new SharedDocumentUnavailableError('unreachable'))
        : Effect.sync(() => {
            calls.push(`attach:${address}`);
          }),
    detach: Effect.sync(() => {
      calls.push('detach');
    }),
    close: Effect.void,
  };
};

describe('shareLiveDocument', () => {
  it('mints what the document holds, attaches to it, and remembers the share', async () => {
    const calls: string[] = [];
    const liveDocument = await createLiveDocument({ calls });

    const url = await Effect.runPromise(
      shareLiveDocument({
        liveDocument,
        shareDocument: ({ content }) =>
          Effect.sync(() => {
            calls.push(`mint:${content}`);
            return 'automerge:url';
          }),
        rememberShare: (shareUrl) => calls.push(`remember:${shareUrl}`),
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
    const liveDocument = await createLiveDocument({ attachFails: true });

    const failure = await Effect.runPromise(
      Effect.flip(
        shareLiveDocument({
          liveDocument,
          shareDocument: () => Effect.succeed('automerge:url'),
          rememberShare,
        })
      )
    );

    expect(failure).toBeInstanceOf(SharedDocumentUnavailableError);
    expect(rememberShare).not.toHaveBeenCalled();
  });
});

describe('joinSharedDocument', () => {
  it('attaches the share, then remembers it', async () => {
    const calls: string[] = [];
    const liveDocument = await createLiveDocument({ calls });

    await Effect.runPromise(
      joinSharedDocument({
        liveDocument,
        rememberShare: (shareUrl) => calls.push(`remember:${shareUrl}`),
      })('automerge:pasted')
    );

    expect(calls).toEqual([
      'attach:automerge:pasted',
      'remember:automerge:pasted',
    ]);
  });

  it('remembers nothing when attaching fails', async () => {
    const rememberShare = vi.fn();
    const liveDocument = await createLiveDocument({ attachFails: true });

    await Effect.runPromise(
      Effect.flip(
        joinSharedDocument({ liveDocument, rememberShare })('automerge:pasted')
      )
    );

    expect(rememberShare).not.toHaveBeenCalled();
  });
});

describe('leaveSharedDocument', () => {
  it('forgets the share, detaches the document, then releases it', async () => {
    const calls: string[] = [];
    const liveDocument = await createLiveDocument({ calls });

    await Effect.runPromise(
      leaveSharedDocument({
        liveDocument,
        forgetShare: () => calls.push('forget'),
        leaveSharedDocument: ({ shareUrl }) =>
          Effect.sync(() => {
            calls.push(`release:${shareUrl}`);
          }),
      })('automerge:url')
    );

    expect(calls).toEqual(['forget', 'detach', 'release:automerge:url']);
  });
});
