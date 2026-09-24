import {
  type AutomergeUrl,
  type Chunk,
  parseAutomergeUrl,
  Repo,
  type StorageAdapterInterface,
  type StorageKey,
} from '@automerge/automerge-repo';
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

const identity = {
  branch: 'main' as Branch,
  documentId: '/blob/main/note.md' as ArtifactId,
};

// What the share was called when made.
const info = { ...identity, name: 'note' };

const seed = (content: string): DocumentContent => ({
  formatVersion: DOCUMENT_FORMAT_VERSION,
  content,
});

const seedShare = (content: string) => ({
  ...seed(content),
  identity,
  name: info.name,
});

const syncFor = (repo: Repo) =>
  createAdapter({ syncedRepo: Effect.succeed(repo) });

// In-memory storage, so a repo keeps documents and sync states the way a
// persistent one does.
class MemoryStorage implements StorageAdapterInterface {
  private readonly chunks = new Map<string, Uint8Array>();

  private static id(key: StorageKey): string {
    return key.join('.');
  }

  async load(key: StorageKey): Promise<Uint8Array | undefined> {
    return this.chunks.get(MemoryStorage.id(key));
  }

  async save(key: StorageKey, data: Uint8Array): Promise<void> {
    this.chunks.set(MemoryStorage.id(key), data);
  }

  async remove(key: StorageKey): Promise<void> {
    this.chunks.delete(MemoryStorage.id(key));
  }

  async loadRange(keyPrefix: StorageKey): Promise<Chunk[]> {
    const prefix = MemoryStorage.id(keyPrefix);
    return [...this.chunks.entries()]
      .filter(([id]) => id.startsWith(prefix))
      .map(([id, data]) => ({ key: id.split('.'), data }));
  }

  async removeRange(keyPrefix: StorageKey): Promise<void> {
    const prefix = MemoryStorage.id(keyPrefix);
    for (const id of [...this.chunks.keys()]) {
      if (id.startsWith(prefix)) this.chunks.delete(id);
    }
  }
}

// Storage that takes its time removing, as IndexedDB does.
class SlowToRemoveStorage extends MemoryStorage {
  async removeRange(keyPrefix: StorageKey): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 20));
    await super.removeRange(keyPrefix);
  }
}

const contentOf = (document: Pick<ConvergentDocument, 'content'>) =>
  Effect.runPromise(SubscriptionRef.get(document.content)).then(
    (state) => state.doc.content
  );

describe('automergeDocumentSharing', () => {
  it('mints a share carrying the content and the format it was written in', async () => {
    const repo = new Repo({ network: [] });

    const shareId = await Effect.runPromise(
      syncFor(repo).shareDocument({ content: 'shared text', ...info })
    );

    const handle = await findShared(repo, shareId);
    expect(handle.fullDoc()).toEqual({
      formatVersion: DOCUMENT_FORMAT_VERSION,
      content: 'shared text',
      identity,
      name: info.name,
    });
  });

  it('tells a peer which document a share is', async () => {
    const { alice, bob } = createPeers();
    const shareId = await Effect.runPromise(
      syncFor(alice).shareDocument({ content: 'for bob', ...info })
    );

    const read = await Effect.runPromise(
      syncFor(bob).getSharedDocumentInfo({ shareId })
    );

    expect(read).toEqual(info);
  });

  it('reads the identity without opening the document', async () => {
    const repo = new Repo({ network: [] });
    const handle = repo.create(seedShare('never opened'));

    const read = await Effect.runPromise(
      syncFor(repo).getSharedDocumentInfo({ shareId: handle.url })
    );

    expect(read).toEqual(info);
  });

  it('refuses to say what a share that names no document is', async () => {
    const repo = new Repo({ network: [] });
    // Readable as a document, but says nothing about where it came from.
    const handle = repo.create<DocumentContent>(seed('no identity'));

    const failure = await Effect.runPromise(
      Effect.flip(syncFor(repo).getSharedDocumentInfo({ shareId: handle.url }))
    );

    expect(failure).toBeInstanceOf(ValidationError);
  });

  it('mints a share the other peer can read', async () => {
    const { alice, bob } = createPeers();

    const shareId = await Effect.runPromise(
      syncFor(alice).shareDocument({ content: 'for bob', ...info })
    );

    const handle = await findShared(bob, shareId);
    expect(handle.fullDoc().content).toBe('for bob');
  });

  // The minted document and the document that gets edited are described in
  // one place; this is what holds minting and opening to it.
  it('mints a share the other peer can open and edit', async () => {
    const { alice, bob } = createPeers();
    const shareId = await Effect.runPromise(
      syncFor(alice).shareDocument({ content: 'seeded by alice', ...info })
    );

    const opened = await Effect.runPromise(
      syncFor(bob).openSharedDocument({ shareId })
    );

    await expect(contentOf(opened)).resolves.toBe('seeded by alice');

    await Effect.runPromise(opened.change('edited by bob'));

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
      Effect.flip(syncFor(repo).openSharedDocument({ shareId: handle.url }))
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
      Effect.flip(syncFor(repo).openSharedDocument({ shareId: handle.url }))
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
      Effect.flip(syncFor(repo).openSharedDocument({ shareId: handle.url }))
    );

    expect(failure).toBeInstanceOf(ValidationError);
  });

  it('refuses a document that is not a share', async () => {
    const repo = new Repo({ network: [] });
    const handle = repo.create({ something: 'else' });

    const failure = await Effect.runPromise(
      Effect.flip(syncFor(repo).openSharedDocument({ shareId: handle.url }))
    );

    expect(failure).toBeInstanceOf(ValidationError);
  });

  it('refuses a link that is not a shared document link', async () => {
    const repo = new Repo({ network: [] });

    const failure = await Effect.runPromise(
      Effect.flip(syncFor(repo).openSharedDocument({ shareId: 'not-a-url' }))
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
      Effect.flip(syncFor(repo).openSharedDocument({ shareId: unreachable }))
    );

    expect(failure).toBeInstanceOf(SharedDocumentUnavailableError);
  }, 20_000);

  it('leaves the shared document with its peers when this client releases it', async () => {
    const { alice, bob } = createPeers();
    const shareId = await Effect.runPromise(
      syncFor(alice).shareDocument({ content: 'still here', ...info })
    );
    const bobHandle = await findShared(bob, shareId);

    await Effect.runPromise(syncFor(alice).leaveSharedDocument({ shareId }));

    expect(bobHandle.fullDoc().content).toBe('still here');
  });

  it('releases a document from storage before resolving', async () => {
    const repo = new Repo({ network: [], storage: new SlowToRemoveStorage() });
    const handle = repo.create<DocumentContent>({
      formatVersion: DOCUMENT_FORMAT_VERSION,
      content: 'kept',
    });
    await repo.flush();
    const { documentId } = parseAutomergeUrl(handle.url);
    expect(await repo.storageSubsystem?.loadDoc(documentId)).not.toBeNull();

    await Effect.runPromise(
      syncFor(repo).leaveSharedDocument({ shareId: handle.url })
    );

    expect(await repo.storageSubsystem?.loadDoc(documentId)).toBeNull();
  });

  it('ignores a release of something that is not a share link', async () => {
    const repo = new Repo({ network: [] });

    await Effect.runPromise(
      syncFor(repo).leaveSharedDocument({ shareId: 'not-a-url' })
    );
  });
});
