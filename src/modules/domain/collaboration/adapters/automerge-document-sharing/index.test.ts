import {
  type AutomergeUrl,
  type Chunk,
  type DocHandle,
  parseAutomergeUrl,
  Repo,
  type StorageAdapterInterface,
  type StorageKey,
} from '@automerge/automerge-repo';
import { MessageChannelNetworkAdapter } from '@automerge/automerge-repo-network-messagechannel';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import {
  type ArtifactId,
  type Branch,
} from '../../../../infrastructure/version-control';
import {
  SharedDocumentUnavailableError,
  UnexpectedDocumentKindError,
  ValidationError,
} from '../../errors';
import {
  type ConvergentDocument,
  type ConvergentDocumentState,
} from '../../ports';
import { createNullPresence } from '../automerge-presence';
import { type AutomergeBinding, createAdapter, createResolverAdapter } from '.';

// A kind of document of the tests' own, holding plain text.
type TextDocument = { text: string };

const textContentSchema = z.object({ text: z.string() });

type TextContent = z.infer<typeof textContentSchema>;

// Its documents show what the share held when opened; the tests read later
// changes off the repos.
const openTextDocument = (handle: DocHandle<TextContent>) =>
  pipe(
    Effect.all({
      content: SubscriptionRef.make<ConvergentDocumentState<TextDocument>>({
        doc: { text: handle.fullDoc().text },
        version: 'opened',
      }),
      presence: createNullPresence<null>(),
    }),
    Effect.map(
      ({ content, presence }): ConvergentDocument<TextDocument, null> => ({
        content,
        change: ({ text }) =>
          Effect.sync(() => {
            handle.change((doc) => {
              doc.text = text;
            });
            return 'changed';
          }),
        presence,
        errors: Stream.empty,
        close: presence.close,
      })
    )
  );

// What the tests' shares say they hold.
const TEXT_KIND = 'TEXT';

const textBinding: AutomergeBinding<TextDocument, null, TextContent> = {
  initialContent: ({ text }) => ({ text }),
  parse: (handle) =>
    textContentSchema.safeParse(handle.fullDoc()).success
      ? Effect.succeed(handle as DocHandle<TextContent>)
      : Effect.fail(new ValidationError('The share holds no text.')),
  open: openTextDocument,
};

const findShared = (repo: Repo, shareId: string) =>
  repo.find<TextContent>(shareId as AutomergeUrl);

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
  documentId: '/blob/main/notes.txt' as ArtifactId,
};

// What the share was called when made.
const info = { ...identity, name: 'notes' };

const seedShare = (text: string) => ({
  text,
  kind: TEXT_KIND,
  identity,
  name: info.name,
});

const syncFor = (repo: Repo) =>
  createAdapter({
    syncedRepo: Effect.succeed(repo),
    kind: TEXT_KIND,
    binding: textBinding,
  });

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

const textOf = (
  document: Pick<ConvergentDocument<TextDocument, null>, 'content'>
) =>
  Effect.runPromise(SubscriptionRef.get(document.content)).then(
    (state) => state.doc.text
  );

describe('automergeDocumentSharing', () => {
  it('mints a share carrying the content of its kind and the document it is', async () => {
    const repo = new Repo({ network: [] });

    const shareId = await Effect.runPromise(
      syncFor(repo).shareDocument({ doc: { text: 'shared text' }, ...info })
    );

    const handle = await findShared(repo, shareId);
    expect(handle.fullDoc()).toEqual(seedShare('shared text'));
  });

  it('tells a peer which document a share is', async () => {
    const { alice, bob } = createPeers();
    const shareId = await Effect.runPromise(
      syncFor(alice).shareDocument({ doc: { text: 'for bob' }, ...info })
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
    // Readable as the kind, but says nothing about where it came from.
    const handle = repo.create({ kind: TEXT_KIND, text: 'no identity' });

    const failure = await Effect.runPromise(
      Effect.flip(syncFor(repo).getSharedDocumentInfo({ shareId: handle.url }))
    );

    expect(failure).toBeInstanceOf(ValidationError);
  });

  it('mints a share the other peer can open and edit', async () => {
    const { alice, bob } = createPeers();
    const shareId = await Effect.runPromise(
      syncFor(alice).shareDocument({
        doc: { text: 'seeded by alice' },
        ...info,
      })
    );

    const opened = await Effect.runPromise(
      syncFor(bob).openSharedDocument({ shareId })
    );

    await expect(textOf(opened)).resolves.toBe('seeded by alice');

    await Effect.runPromise(opened.change({ text: 'edited by bob' }));

    const aliceHandle = await findShared(alice, shareId);
    await vi.waitFor(() =>
      expect(aliceHandle.fullDoc().text).toBe('edited by bob')
    );
  });

  it('refuses a share of another kind, before reading its content', async () => {
    const repo = new Repo({ network: [] });
    const handle = repo.create({ ...seedShare('text'), kind: 'OTHER' });

    const opening = await Effect.runPromise(
      Effect.flip(syncFor(repo).openSharedDocument({ shareId: handle.url }))
    );
    const reading = await Effect.runPromise(
      Effect.flip(syncFor(repo).getSharedDocumentInfo({ shareId: handle.url }))
    );

    expect(opening).toBeInstanceOf(UnexpectedDocumentKindError);
    expect(reading).toBeInstanceOf(UnexpectedDocumentKindError);
  });

  it('refuses a share that does not say what kind it holds', async () => {
    const repo = new Repo({ network: [] });
    const handle = repo.create({ text: 'text', identity, name: info.name });

    const failure = await Effect.runPromise(
      Effect.flip(syncFor(repo).openSharedDocument({ shareId: handle.url }))
    );

    expect(failure).toBeInstanceOf(ValidationError);
  });

  it('refuses a share its kind cannot read', async () => {
    const repo = new Repo({ network: [] });
    const handle = repo.create({ kind: TEXT_KIND, something: 'else' });

    const failure = await Effect.runPromise(
      Effect.flip(syncFor(repo).openSharedDocument({ shareId: handle.url }))
    );

    expect(failure).toBeInstanceOf(ValidationError);
    expect(failure.message).toBe('The share holds no text.');
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
    const unreachable = new Repo({ network: [] }).create(
      seedShare('elsewhere')
    ).url;

    const failure = await Effect.runPromise(
      Effect.flip(syncFor(repo).openSharedDocument({ shareId: unreachable }))
    );

    expect(failure).toBeInstanceOf(SharedDocumentUnavailableError);
  }, 20_000);

  it('leaves the shared document with its peers when this client releases it', async () => {
    const { alice, bob } = createPeers();
    const shareId = await Effect.runPromise(
      syncFor(alice).shareDocument({ doc: { text: 'still here' }, ...info })
    );
    const bobHandle = await findShared(bob, shareId);

    await Effect.runPromise(syncFor(alice).leaveSharedDocument({ shareId }));

    expect(bobHandle.fullDoc().text).toBe('still here');
  });

  it('releases a document from storage before resolving', async () => {
    const repo = new Repo({ network: [], storage: new SlowToRemoveStorage() });
    const handle = repo.create(seedShare('kept'));
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

describe('automergeSharedDocumentResolver', () => {
  const resolverFor = (repo: Repo) =>
    createResolverAdapter({ syncedRepo: Effect.succeed(repo) });

  it('tells what kind of document a share holds, whatever the kind', async () => {
    const repo = new Repo({ network: [] });
    // Content no binding of these tests reads.
    const handle = repo.create({ kind: 'OTHER', spans: [] });

    const kind = await Effect.runPromise(
      resolverFor(repo).getSharedDocumentKind({ shareId: handle.url })
    );

    expect(kind).toBe('OTHER');
  });

  it('refuses a share that does not say what kind it holds', async () => {
    const repo = new Repo({ network: [] });
    const handle = repo.create({ text: 'no kind' });

    const failure = await Effect.runPromise(
      Effect.flip(
        resolverFor(repo).getSharedDocumentKind({ shareId: handle.url })
      )
    );

    expect(failure).toBeInstanceOf(ValidationError);
  });

  it('refuses a link that is not a shared document link', async () => {
    const repo = new Repo({ network: [] });

    const failure = await Effect.runPromise(
      Effect.flip(
        resolverFor(repo).getSharedDocumentKind({ shareId: 'not-a-url' })
      )
    );

    expect(failure).toBeInstanceOf(ValidationError);
  });
});
