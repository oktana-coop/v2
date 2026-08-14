// The full build initializes the WebAssembly the slim build (used by the code
// under test) needs. In the app that is `createAutomergeRepo`'s job.
import '@automerge/automerge';

import * as Automerge from '@automerge/automerge/slim';
import {
  type AutomergeUrl,
  type DocHandle,
  Repo,
} from '@automerge/automerge-repo/slim';
import { MessageChannelNetworkAdapter } from '@automerge/automerge-repo-network-messagechannel';
import * as Effect from 'effect/Effect';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { subscribeToRefChanges } from '../../../../../utils/effect';
import {
  SharedDocumentUnavailableError,
  UnsupportedShareFormatError,
  ValidationError,
} from '../../errors';
import {
  CURRENT_SCHEMA_VERSION,
  PRIMARY_RICH_TEXT_REPRESENTATION,
  type RichTextDocument,
  richTextRepresentations,
} from '../../models';
import { type LiveDocument } from '../../ports/live-document';
import { createAdapter } from '.';
import { SHARE_FORMAT_VERSION, type SharedContent } from './shared-content';

const markdown = (content: string): RichTextDocument => ({
  schemaVersion: CURRENT_SCHEMA_VERSION,
  representation: PRIMARY_RICH_TEXT_REPRESENTATION,
  content,
});

// What the editor contributes: ProseMirror content that has to be converted on
// its way into the shared document.
const editorDocument = (content: string): RichTextDocument => ({
  schemaVersion: CURRENT_SCHEMA_VERSION,
  representation: richTextRepresentations.PROSEMIRROR,
  content,
});

// The fake conversion the editor path runs; `pm:` marks what went through it.
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

const open = (repo: Repo, shareUrl: string, onError = vi.fn()) =>
  Effect.runPromise(
    createAdapter({ repo, shareUrl, transformToText, onError })
  );

const contentOf = (live: LiveDocument) =>
  Effect.runPromise(SubscriptionRef.get(live.content)).then(
    (change) => change.doc.content
  );

const versionOf = (live: LiveDocument) =>
  Effect.runPromise(SubscriptionRef.get(live.content)).then(
    (change) => change.version
  );

const textOf = (handle: DocHandle<SharedContent>) => handle.doc().content;

describe('automergeLiveDocument', () => {
  beforeEach(() => {
    transformToText.mockReset();
    transformToText.mockImplementation(async ({ input }: { input: string }) =>
      input.replace(/^pm:/, '')
    );
  });

  it('opens with the shared document as its content', async () => {
    const repo = new Repo({ network: [] });
    const handle = repo.create<SharedContent>(seed('shared text'));

    const live = await open(repo, handle.url);

    await expect(contentOf(live)).resolves.toBe('shared text');
    const current = await Effect.runPromise(SubscriptionRef.get(live.content));
    expect(current.doc.representation).toBe(PRIMARY_RICH_TEXT_REPRESENTATION);
  });

  it('converts an editor contribution and applies it to the shared document', async () => {
    const repo = new Repo({ network: [] });
    const handle = repo.create<SharedContent>(seed('hello'));
    const live = await open(repo, handle.url);

    await Effect.runPromise(live.change(editorDocument('pm:hello world')));

    expect(transformToText).toHaveBeenCalledTimes(1);
    expect(textOf(handle)).toBe('hello world');
  });

  it('applies content that is already primary text without converting it', async () => {
    const repo = new Repo({ network: [] });
    const handle = repo.create<SharedContent>(seed('hello'));
    const live = await open(repo, handle.url);

    await Effect.runPromise(live.change(markdown('straight through')));

    expect(transformToText).not.toHaveBeenCalled();
    expect(textOf(handle)).toBe('straight through');
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

  // The editor contributes whole documents, so a contribution derived from a
  // state that does not yet include a peer's edit would read that edit as a
  // deletion. Anchoring the change at the state it was derived from is what
  // keeps both edits.
  it('keeps a concurrent edit it had not seen when the contribution was made', async () => {
    const repo = new Repo({ network: [] });
    const handle = repo.create<SharedContent>(seed('one two three'));
    const live = await open(repo, handle.url);

    const base = await versionOf(live);

    // Arrives after the contribution below was derived, as a peer's edit would.
    handle.change((doc) =>
      Automerge.updateText(doc, ['content'], 'one two three PEER')
    );

    await Effect.runPromise(
      live.change(markdown('one two three LOCAL'), { base })
    );

    expect(textOf(handle)).toContain('PEER');
    expect(textOf(handle)).toContain('LOCAL');
  });

  it('applies a contribution derived from the current state directly', async () => {
    const repo = new Repo({ network: [] });
    const handle = repo.create<SharedContent>(seed('hello'));
    const live = await open(repo, handle.url);

    const base = await versionOf(live);
    const version = await Effect.runPromise(
      live.change(markdown('hello there'), { base })
    );

    expect(textOf(handle)).toBe('hello there');
    // The version a contribution resolves with is the one its emission
    // carries, which is how the editor recognises its own contribution.
    await vi.waitFor(async () => expect(await versionOf(live)).toBe(version));
  });

  it('publishes a change made outside this adapter', async () => {
    const repo = new Repo({ network: [] });
    const handle = repo.create<SharedContent>(seed('hello'));
    const live = await open(repo, handle.url);

    handle.change((doc) =>
      Automerge.updateText(doc, ['content'], 'changed elsewhere')
    );

    await vi.waitFor(async () =>
      expect(await contentOf(live)).toBe('changed elsewhere')
    );
  });

  it('publishes nothing when a change leaves the text as it was', async () => {
    const repo = new Repo({ network: [] });
    const handle = repo.create<SharedContent>(seed('hello'));
    const live = await open(repo, handle.url);

    const received: string[] = [];
    const unsubscribe = subscribeToRefChanges(live.content, (change) =>
      received.push(change.doc.content)
    );

    handle.change((doc) => Automerge.updateText(doc, ['content'], 'hello'));

    // Nothing to wait for: give a publication its chance to arrive, then
    // assert none did.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(received).toEqual([]);

    unsubscribe();
  });

  it('applies only the newest of several contributions made in a burst', async () => {
    const repo = new Repo({ network: [] });
    const handle = repo.create<SharedContent>(seed('start'));
    const live = await open(repo, handle.url);

    // The earlier contribution converts slowest, so applying whatever finishes
    // last would leave the older text in the document.
    const delays: Record<string, number> = { first: 40, second: 20, latest: 0 };
    transformToText.mockImplementation(async ({ input }: { input: string }) => {
      const text = input.replace(/^pm:/, '');
      await new Promise((resolve) => setTimeout(resolve, delays[text] ?? 0));
      return text;
    });

    await Promise.all([
      Effect.runPromise(live.change(editorDocument('pm:first'))),
      Effect.runPromise(live.change(editorDocument('pm:second'))),
      Effect.runPromise(live.change(editorDocument('pm:latest'))),
    ]);

    expect(textOf(handle)).toBe('latest');
  });

  it('stops publishing once closed', async () => {
    const repo = new Repo({ network: [] });
    const handle = repo.create<SharedContent>(seed('hello'));
    const live = await open(repo, handle.url);

    await Effect.runPromise(live.close);

    handle.change((doc) =>
      Automerge.updateText(doc, ['content'], 'after closing')
    );

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(await contentOf(live)).toBe('hello');
  });

  it('refuses a share whose format it does not implement', async () => {
    const repo = new Repo({ network: [] });
    const handle = repo.create({
      shareFormatVersion: SHARE_FORMAT_VERSION + 1,
      content: 'from a newer app',
    });

    const failure = await Effect.runPromise(
      Effect.flip(
        createAdapter({
          repo,
          shareUrl: handle.url,
          transformToText,
          onError: vi.fn(),
        })
      )
    );

    expect(failure).toBeInstanceOf(UnsupportedShareFormatError);
  });

  it('refuses a document that is not a share', async () => {
    const repo = new Repo({ network: [] });
    const handle = repo.create({ something: 'else' });

    const failure = await Effect.runPromise(
      Effect.flip(
        createAdapter({
          repo,
          shareUrl: handle.url,
          transformToText,
          onError: vi.fn(),
        })
      )
    );

    expect(failure).toBeInstanceOf(ValidationError);
  });

  it('refuses a link that is not a shared document link', async () => {
    const repo = new Repo({ network: [] });

    const failure = await Effect.runPromise(
      Effect.flip(
        createAdapter({
          repo,
          shareUrl: 'not-a-url',
          transformToText,
          onError: vi.fn(),
        })
      )
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
      Effect.flip(
        createAdapter({
          repo,
          shareUrl: unreachable,
          transformToText,
          onError: vi.fn(),
        })
      )
    );

    expect(failure).toBeInstanceOf(SharedDocumentUnavailableError);
  }, 20_000);
});
