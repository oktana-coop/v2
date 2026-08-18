// The full build initializes the WebAssembly the slim build (used by the code
// under test) needs. In the app that is `createAutomergeRepo`'s job.
import '@automerge/automerge';

import { type AutomergeUrl, Repo } from '@automerge/automerge-repo/slim';
import { MessageChannelNetworkAdapter } from '@automerge/automerge-repo-network-messagechannel';
import * as Effect from 'effect/Effect';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { describe, expect, it, vi } from 'vitest';

import {
  CURRENT_SCHEMA_VERSION,
  PRIMARY_RICH_TEXT_REPRESENTATION,
  type RichTextDocument,
} from '../../../rich-text';
import {
  createAdapter as createAutomergeLiveDocumentAdapter,
  SHARE_FORMAT_VERSION,
  type SharedContent,
} from '../../../rich-text/adapters/automerge-live-document';
import { createAdapter } from '.';

const markdown = (content: string): RichTextDocument => ({
  schemaVersion: CURRENT_SCHEMA_VERSION,
  representation: PRIMARY_RICH_TEXT_REPRESENTATION,
  content,
});

// The port hands out plain strings; only automerge-repo cares that they parse.
const findShared = (repo: Repo, shareUrl: string) =>
  repo.find<SharedContent>(shareUrl as AutomergeUrl);

const createPeers = () => {
  const channel = new MessageChannel();

  return {
    alice: new Repo({
      network: [new MessageChannelNetworkAdapter(channel.port1)],
    }),
    bob: new Repo({
      network: [new MessageChannelNetworkAdapter(channel.port2)],
    }),
  };
};

describe('automergeProjectSync', () => {
  it('mints a share carrying the content and the format it was written in', async () => {
    const repo = new Repo({ network: [] });
    const projectSync = createAdapter({ repo });

    const shareUrl = await Effect.runPromise(
      projectSync.shareDocument({ content: 'shared text' })
    );

    const handle = await findShared(repo, shareUrl);
    expect(handle.doc()).toEqual({
      shareFormatVersion: SHARE_FORMAT_VERSION,
      content: 'shared text',
    });
  });

  it('mints a share the other peer can read', async () => {
    const { alice, bob } = createPeers();

    const shareUrl = await Effect.runPromise(
      createAdapter({ repo: alice }).shareDocument({
        content: 'for bob',
      })
    );

    const handle = await findShared(bob, shareUrl);
    expect(handle.doc().content).toBe('for bob');
  });

  // The minted document and the document the live adapter edits are described
  // in one place; this is what holds the two adapters to it.
  it('mints a share the live document adapter can open and edit', async () => {
    const { alice, bob } = createPeers();

    const shareUrl = await Effect.runPromise(
      createAdapter({ repo: alice }).shareDocument({
        content: 'seeded by alice',
      })
    );

    const bobLive = await Effect.runPromise(
      createAutomergeLiveDocumentAdapter({
        privateRepo: Effect.succeed(bob),
        syncedRepo: Effect.succeed(bob),
        address: shareUrl,
        initialText: 'what bob had on disk',
        transformToText: vi.fn(),
        onError: vi.fn(),
      })
    );

    const opened = await Effect.runPromise(
      SubscriptionRef.get(bobLive.content)
    );
    expect(opened.doc.content).toBe('seeded by alice');

    await Effect.runPromise(bobLive.change(markdown('edited by bob')));

    const aliceHandle = await findShared(alice, shareUrl);
    await vi.waitFor(() =>
      expect(aliceHandle.doc().content).toBe('edited by bob')
    );
  });

  it('leaves the shared document with its peers when this client releases it', async () => {
    const { alice, bob } = createPeers();

    const shareUrl = await Effect.runPromise(
      createAdapter({ repo: alice }).shareDocument({
        content: 'still here',
      })
    );
    const bobHandle = await findShared(bob, shareUrl);

    await Effect.runPromise(
      createAdapter({ repo: alice }).leaveSharedDocument({ shareUrl })
    );

    expect(bobHandle.doc().content).toBe('still here');
  });

  it('ignores a release of something that is not a share link', async () => {
    const repo = new Repo({ network: [] });

    await Effect.runPromise(
      createAdapter({ repo }).leaveSharedDocument({ shareUrl: 'not-a-url' })
    );
  });
});
