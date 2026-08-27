// The full build initializes the WebAssembly the slim build (used by the code
// under test) needs. In the app that is `createAutomergeRepo`'s job.
import '@automerge/automerge';

import { type AutomergeUrl, Repo } from '@automerge/automerge-repo/slim';
import { MessageChannelNetworkAdapter } from '@automerge/automerge-repo-network-messagechannel';
import * as Effect from 'effect/Effect';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { describe, expect, it, vi } from 'vitest';

import {
  type ArtifactId,
  type Branch,
} from '../../../../infrastructure/version-control';
import {
  type ConvergentDocument,
  UnsupportedDocumentFormatError,
  ValidationError,
} from '../../../rich-text';
import {
  DOCUMENT_FORMAT_VERSION,
  type DocumentContent,
} from '../../../rich-text/adapters/automerge-convergent-document';
import { SharedDocumentUnavailableError } from '../../errors';
import { createAdapter } from '.';

// The port hands out plain strings; only automerge-repo cares that they parse.
const findShared = (repo: Repo, shareUrl: string) =>
  repo.find<DocumentContent>(shareUrl as AutomergeUrl);

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

const identity = {
  branch: 'main' as Branch,
  documentId: '/blob/main/note.md' as ArtifactId,
};

const seed = (content: string): DocumentContent => ({
  formatVersion: DOCUMENT_FORMAT_VERSION,
  content,
});

const seedShare = (content: string) => ({ ...seed(content), identity });

const syncFor = (repo: Repo) =>
  createAdapter({ syncedRepo: Effect.succeed(repo) });

const contentOf = (document: Pick<ConvergentDocument, 'content'>) =>
  Effect.runPromise(SubscriptionRef.get(document.content)).then(
    (state) => state.doc.content
  );

describe('automergeDocumentSharing', () => {
  it('mints a share carrying the content and the format it was written in', async () => {
    const repo = new Repo({ network: [] });

    const shareUrl = await Effect.runPromise(
      syncFor(repo).shareDocument({ content: 'shared text', ...identity })
    );

    const handle = await findShared(repo, shareUrl);
    expect(handle.doc()).toEqual({
      formatVersion: DOCUMENT_FORMAT_VERSION,
      content: 'shared text',
      identity,
    });
  });

  it('tells a peer which document a share is', async () => {
    const { alice, bob } = createPeers();
    const shareUrl = await Effect.runPromise(
      syncFor(alice).shareDocument({ content: 'for bob', ...identity })
    );

    const read = await Effect.runPromise(
      syncFor(bob).getSharedDocumentIdentity({ shareUrl })
    );

    expect(read).toEqual(identity);
  });

  it('reads the identity without opening the document', async () => {
    const repo = new Repo({ network: [] });
    const handle = repo.create(seedShare('never opened'));

    const read = await Effect.runPromise(
      syncFor(repo).getSharedDocumentIdentity({ shareUrl: handle.url })
    );

    expect(read).toEqual(identity);
  });

  it('refuses to say what a share that names no document is', async () => {
    const repo = new Repo({ network: [] });
    // Readable as a document, but says nothing about where it came from.
    const handle = repo.create<DocumentContent>(seed('no identity'));

    const failure = await Effect.runPromise(
      Effect.flip(
        syncFor(repo).getSharedDocumentIdentity({ shareUrl: handle.url })
      )
    );

    expect(failure).toBeInstanceOf(ValidationError);
  });

  it('mints a share the other peer can read', async () => {
    const { alice, bob } = createPeers();

    const shareUrl = await Effect.runPromise(
      syncFor(alice).shareDocument({ content: 'for bob', ...identity })
    );

    const handle = await findShared(bob, shareUrl);
    expect(handle.doc().content).toBe('for bob');
  });

  // The minted document and the document that gets edited are described in
  // one place; this is what holds minting and opening to it.
  it('mints a share the other peer can open and edit', async () => {
    const { alice, bob } = createPeers();
    const shareUrl = await Effect.runPromise(
      syncFor(alice).shareDocument({ content: 'seeded by alice', ...identity })
    );

    const opened = await Effect.runPromise(
      syncFor(bob).openSharedDocument({ shareUrl })
    );

    await expect(contentOf(opened)).resolves.toBe('seeded by alice');

    await Effect.runPromise(opened.change('edited by bob'));

    const aliceHandle = await findShared(alice, shareUrl);
    await vi.waitFor(() =>
      expect(aliceHandle.doc().content).toBe('edited by bob')
    );
  });

  it('opens a share both peers then converge on', async () => {
    const { alice, bob } = createPeers();
    const handle = alice.create<DocumentContent>(seed('hello'));
    const aliceDocument = await Effect.runPromise(
      syncFor(alice).openSharedDocument({ shareUrl: handle.url })
    );
    const bobDocument = await Effect.runPromise(
      syncFor(bob).openSharedDocument({ shareUrl: handle.url })
    );

    await Effect.runPromise(aliceDocument.change('hello from alice'));

    await vi.waitFor(async () =>
      expect(await contentOf(bobDocument)).toBe('hello from alice')
    );
  });

  it('refuses a share whose format it does not implement', async () => {
    const repo = new Repo({ network: [] });
    const handle = repo.create({
      formatVersion: DOCUMENT_FORMAT_VERSION + 1,
      content: 'from a newer app',
    });

    const failure = await Effect.runPromise(
      Effect.flip(syncFor(repo).openSharedDocument({ shareUrl: handle.url }))
    );

    expect(failure).toBeInstanceOf(UnsupportedDocumentFormatError);
  });

  it('refuses a newer format even when it holds nothing this one would recognize', async () => {
    const repo = new Repo({ network: [] });
    // A later format need not keep its text in `content`, or at all: the
    // version is read before anything else, so the shape never comes up.
    const handle = repo.create({
      formatVersion: DOCUMENT_FORMAT_VERSION + 1,
      spans: [{ kind: 'paragraph' }],
    });

    const failure = await Effect.runPromise(
      Effect.flip(syncFor(repo).openSharedDocument({ shareUrl: handle.url }))
    );

    // Knowing what it is and being unable to read it is not the same as it
    // never having been a share.
    expect(failure).toBeInstanceOf(UnsupportedDocumentFormatError);
  });

  it('refuses a share of its own format that holds the wrong thing', async () => {
    const repo = new Repo({ network: [] });
    const handle = repo.create({
      formatVersion: DOCUMENT_FORMAT_VERSION,
      content: 42,
    });

    const failure = await Effect.runPromise(
      Effect.flip(syncFor(repo).openSharedDocument({ shareUrl: handle.url }))
    );

    expect(failure).toBeInstanceOf(ValidationError);
  });

  it('refuses a document that is not a share', async () => {
    const repo = new Repo({ network: [] });
    const handle = repo.create({ something: 'else' });

    const failure = await Effect.runPromise(
      Effect.flip(syncFor(repo).openSharedDocument({ shareUrl: handle.url }))
    );

    expect(failure).toBeInstanceOf(ValidationError);
  });

  it('refuses a link that is not a shared document link', async () => {
    const repo = new Repo({ network: [] });

    const failure = await Effect.runPromise(
      Effect.flip(syncFor(repo).openSharedDocument({ shareUrl: 'not-a-url' }))
    );

    expect(failure).toBeInstanceOf(ValidationError);
  });

  it('fails when the shared document cannot be reached', async () => {
    const repo = new Repo({ network: [] });
    // A well-formed link to a document no reachable peer has.
    const unreachable = new Repo({ network: [] }).create<DocumentContent>(
      seed('elsewhere')
    ).url;

    const failure = await Effect.runPromise(
      Effect.flip(syncFor(repo).openSharedDocument({ shareUrl: unreachable }))
    );

    expect(failure).toBeInstanceOf(SharedDocumentUnavailableError);
  }, 20_000);

  it('leaves the shared document with its peers when this client releases it', async () => {
    const { alice, bob } = createPeers();
    const shareUrl = await Effect.runPromise(
      syncFor(alice).shareDocument({ content: 'still here', ...identity })
    );
    const bobHandle = await findShared(bob, shareUrl);

    await Effect.runPromise(syncFor(alice).leaveSharedDocument({ shareUrl }));

    expect(bobHandle.doc().content).toBe('still here');
  });

  it('ignores a release of something that is not a share link', async () => {
    const repo = new Repo({ network: [] });

    await Effect.runPromise(
      syncFor(repo).leaveSharedDocument({ shareUrl: 'not-a-url' })
    );
  });
});
