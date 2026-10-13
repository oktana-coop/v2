import { type AutomergeUrl, Repo } from '@automerge/automerge-repo';
import { MessageChannelNetworkAdapter } from '@automerge/automerge-repo-network-messagechannel';
import * as Effect from 'effect/Effect';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { describe, expect, it, vi } from 'vitest';

import {
  type ArtifactId,
  type Branch,
} from '../../../../infrastructure/version-control';
import {
  UnsupportedDocumentFormatError,
  ValidationError,
} from '../../../collaboration';
import { createAdapter } from '../../../collaboration/adapters/automerge-document-sharing';
import { plainTextDocument } from '../../models';
import { type PlainTextConvergentDocument } from '../../ports';
import { plainTextAutomergeBinding } from './automerge-binding';
import {
  DOCUMENT_FORMAT_VERSION,
  DOCUMENT_KIND,
  type DocumentContent,
} from './document-content';

const findShared = (repo: Repo, shareId: string) =>
  repo.find<DocumentContent>(shareId as AutomergeUrl);

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

const info = {
  branch: 'main' as Branch,
  documentId: '/blob/main/config.yaml' as ArtifactId,
  name: 'config.yaml',
};

const seed = (content: string): DocumentContent => ({
  kind: DOCUMENT_KIND,
  formatVersion: DOCUMENT_FORMAT_VERSION,
  content,
});

const syncFor = (repo: Repo) =>
  createAdapter({
    syncedRepo: Effect.succeed(repo),
    binding: plainTextAutomergeBinding,
  });

const contentOf = (document: Pick<PlainTextConvergentDocument, 'content'>) =>
  Effect.runPromise(SubscriptionRef.get(document.content)).then(
    (state) => state.doc.content
  );

describe('plainTextAutomergeBinding', () => {
  it('mints a share carrying the content and the format it was written in', async () => {
    const repo = new Repo({ network: [] });

    const shareId = await Effect.runPromise(
      syncFor(repo).shareDocument({
        doc: plainTextDocument('shared text'),
        ...info,
      })
    );

    const handle = await findShared(repo, shareId);
    expect(handle.fullDoc()).toMatchObject(seed('shared text'));
  });

  // The minted document and the document that gets edited are described in
  // one place; this is what holds minting and opening to it.
  it('mints a share the other peer can open and edit', async () => {
    const { alice, bob } = createPeers();
    const shareId = await Effect.runPromise(
      syncFor(alice).shareDocument({
        doc: plainTextDocument('seeded by alice'),
        ...info,
      })
    );

    const opened = await Effect.runPromise(
      syncFor(bob).openSharedDocument({ shareId })
    );

    await expect(contentOf(opened)).resolves.toBe('seeded by alice');

    await Effect.runPromise(opened.change(plainTextDocument('edited by bob')));

    const aliceHandle = await findShared(alice, shareId);
    await vi.waitFor(() =>
      expect(aliceHandle.fullDoc().content).toBe('edited by bob')
    );
  });

  it('opens a share both peers then converge on', async () => {
    const { alice, bob } = createPeers();
    const handle = alice.create<DocumentContent>(seed('hello'));
    const aliceDocument = await Effect.runPromise(
      syncFor(alice).openSharedDocument({ shareId: handle.url })
    );
    const bobDocument = await Effect.runPromise(
      syncFor(bob).openSharedDocument({ shareId: handle.url })
    );

    await Effect.runPromise(
      aliceDocument.change(plainTextDocument('hello from alice'))
    );

    await vi.waitFor(async () =>
      expect(await contentOf(bobDocument)).toBe('hello from alice')
    );
  });

  it('refuses a share whose format it does not implement', async () => {
    const repo = new Repo({ network: [] });
    const handle = repo.create({
      kind: DOCUMENT_KIND,
      formatVersion: DOCUMENT_FORMAT_VERSION + 1,
      content: 'from a newer app',
    });

    const failure = await Effect.runPromise(
      Effect.flip(syncFor(repo).openSharedDocument({ shareId: handle.url }))
    );

    expect(failure).toBeInstanceOf(UnsupportedDocumentFormatError);
  });

  it('refuses a newer format even when it holds nothing this one would recognize', async () => {
    const repo = new Repo({ network: [] });
    // A later format need not keep its text in `content`, or at all: the
    // version is read before anything else, so the shape never comes up.
    const handle = repo.create({
      kind: DOCUMENT_KIND,
      formatVersion: DOCUMENT_FORMAT_VERSION + 1,
      spans: [{ kind: 'paragraph' }],
    });

    const failure = await Effect.runPromise(
      Effect.flip(syncFor(repo).openSharedDocument({ shareId: handle.url }))
    );

    // Knowing what it is and being unable to read it is not the same as it
    // never having been a share.
    expect(failure).toBeInstanceOf(UnsupportedDocumentFormatError);
  });

  it('refuses a share of its own format that holds the wrong thing', async () => {
    const repo = new Repo({ network: [] });
    const handle = repo.create({
      kind: DOCUMENT_KIND,
      formatVersion: DOCUMENT_FORMAT_VERSION,
      content: 42,
    });

    const failure = await Effect.runPromise(
      Effect.flip(syncFor(repo).openSharedDocument({ shareId: handle.url }))
    );

    expect(failure).toBeInstanceOf(ValidationError);
  });

  it('refuses a document of another kind', async () => {
    const repo = new Repo({ network: [] });
    const handle = repo.create({
      kind: 'RICH_TEXT',
      formatVersion: DOCUMENT_FORMAT_VERSION,
      content: '# Notes',
    });

    const failure = await Effect.runPromise(
      Effect.flip(syncFor(repo).openSharedDocument({ shareId: handle.url }))
    );

    expect(failure).toBeInstanceOf(ValidationError);
  });

  it('refuses a document that is not a plain-text share', async () => {
    const repo = new Repo({ network: [] });
    const handle = repo.create({ something: 'else' });

    const failure = await Effect.runPromise(
      Effect.flip(syncFor(repo).openSharedDocument({ shareId: handle.url }))
    );

    expect(failure).toBeInstanceOf(ValidationError);
  });
});
