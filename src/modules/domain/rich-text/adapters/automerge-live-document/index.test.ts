// The full build initializes the WebAssembly the slim build (used by the code
// under test) needs. In the app that is `createAutomergeRepo`'s job.
import '@automerge/automerge';

import { type AutomergeUrl, Repo } from '@automerge/automerge-repo/slim';
import { MessageChannelNetworkAdapter } from '@automerge/automerge-repo-network-messagechannel';
import * as Effect from 'effect/Effect';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { describe, expect, it, vi } from 'vitest';

import {
  SharedDocumentUnavailableError,
  UnsupportedShareFormatError,
  ValidationError,
} from '../../errors';
import {
  CURRENT_SCHEMA_VERSION,
  PRIMARY_RICH_TEXT_REPRESENTATION,
  type RichTextDocument,
} from '../../models';
import { type AutomergeLiveDocument, createAdapter } from '.';
import { SHARE_FORMAT_VERSION, type SharedContent } from './shared-content';

const markdown = (content: string): RichTextDocument => ({
  schemaVersion: CURRENT_SCHEMA_VERSION,
  representation: PRIMARY_RICH_TEXT_REPRESENTATION,
  content,
});

const transformToText = vi.fn(async ({ input }: { input: string }) =>
  input.replace(/^pm:/, '')
);

const seed = (content: string): SharedContent => ({
  shareFormatVersion: SHARE_FORMAT_VERSION,
  content,
});

// A pair of connected repos, standing in for two peers.
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

// The disk plays no part in these tests: opening is what is under test here;
// the running document is covered in live-document.test.ts.
const diskDeps = {
  readDocument: Effect.succeed(markdown('on disk')),
  writeDocument: (doc: RichTextDocument) => Effect.succeed(doc.content),
  subscribeToDocumentChanges: () => () => {},
};

const openEffect = (repo: Repo, shareUrl: string, onError = vi.fn()) =>
  createAdapter({
    repo,
    initial: markdown('what this app had on disk'),
    shareUrl,
    transformToText,
    onError,
    ...diskDeps,
  });

const open = (repo: Repo, shareUrl: string, onError = vi.fn()) =>
  Effect.runPromise(openEffect(repo, shareUrl, onError));

const contentOf = (live: Pick<AutomergeLiveDocument, 'content'>) =>
  Effect.runPromise(SubscriptionRef.get(live.content)).then(
    (change) => change.doc.content
  );

describe('automergeLiveDocument adapter', () => {
  it('starts a document from the store when it has no address', async () => {
    const repo = new Repo({ network: [] });

    const live = await Effect.runPromise(
      createAdapter({
        repo,
        initial: markdown('fresh from disk'),
        transformToText,
        onError: vi.fn(),
        ...diskDeps,
      })
    );

    await expect(contentOf(live)).resolves.toBe('fresh from disk');
  });

  it('opens on the shared content, not on what this app had on disk', async () => {
    const repo = new Repo({ network: [] });
    const handle = repo.create<SharedContent>(seed('shared text'));

    const live = await open(repo, handle.url);

    await expect(contentOf(live)).resolves.toBe('shared text');
  });

  it('reaches the other peer', async () => {
    const { alice, bob } = createPeers();
    const aliceHandle = alice.create<SharedContent>(seed('hello'));
    const aliceLive = await open(alice, aliceHandle.url);
    const bobLive = await open(bob, aliceHandle.url);

    await Effect.runPromise(aliceLive.change(markdown('hello from alice')));

    await vi.waitFor(async () =>
      expect(await contentOf(bobLive)).toBe('hello from alice')
    );
  });

  it('refuses a share whose format it does not implement', async () => {
    const repo = new Repo({ network: [] });
    const handle = repo.create({
      shareFormatVersion: SHARE_FORMAT_VERSION + 1,
      content: 'from a newer app',
    });

    const failure = await Effect.runPromise(
      Effect.flip(openEffect(repo, handle.url))
    );

    expect(failure).toBeInstanceOf(UnsupportedShareFormatError);
  });

  it('refuses a document that is not a share', async () => {
    const repo = new Repo({ network: [] });
    const handle = repo.create({ something: 'else' });

    const failure = await Effect.runPromise(
      Effect.flip(openEffect(repo, handle.url))
    );

    expect(failure).toBeInstanceOf(ValidationError);
  });

  it('refuses a link that is not a shared document link', async () => {
    const repo = new Repo({ network: [] });

    const failure = await Effect.runPromise(
      Effect.flip(openEffect(repo, 'not-a-url'))
    );

    expect(failure).toBeInstanceOf(ValidationError);
  });

  it('fails when the shared document cannot be reached', async () => {
    const repo = new Repo({ network: [] });
    // A well-formed link to a document no reachable peer has.
    const unreachable = new Repo({ network: [] }).create<SharedContent>(
      seed('elsewhere')
    ).url as AutomergeUrl;

    const failure = await Effect.runPromise(
      Effect.flip(openEffect(repo, unreachable))
    );

    expect(failure).toBeInstanceOf(SharedDocumentUnavailableError);
  }, 20_000);
});
