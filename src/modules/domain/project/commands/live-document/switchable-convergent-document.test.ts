import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { describe, expect, it } from 'vitest';

import {
  type ConvergentDocument,
  type ConvergentDocumentState,
  type LocalPresence,
  type RemotePresence,
  richTextRepresentations,
} from '../../../../../modules/domain/rich-text';
import { parseUsername } from '../../../../auth';
import { createSwitchableDocument } from './switchable-convergent-document';

const markdown = (content: string) => ({
  schemaVersion: 1,
  representation: richTextRepresentations.MARKDOWN,
  content,
});

const remote = (name: string): RemotePresence => ({
  peerId: name.toLowerCase(),
  participant: { name: parseUsername(name), email: null, avatarUrl: null },
  selection: null,
});

const local: LocalPresence = {
  participant: { name: parseUsername('Me'), email: null, avatarUrl: null },
  selection: null,
};

// A document whose presence records what is published to it and whose peers
// the test sets directly.
const createFakeDocument = async (text: string, peers: RemotePresence[]) => {
  const content = await Effect.runPromise(
    SubscriptionRef.make<ConvergentDocumentState>({
      doc: markdown(text),
      version: `${text}.0`,
    })
  );
  const peersRef = await Effect.runPromise(
    SubscriptionRef.make<ReadonlyArray<RemotePresence>>(peers)
  );
  const published: LocalPresence[] = [];
  let closed = false;

  const document: ConvergentDocument = {
    content,
    change: (next) =>
      Effect.as(
        SubscriptionRef.set(content, {
          doc: markdown(next),
          version: `${next}.1`,
        }),
        `${next}.1`
      ),
    presence: {
      peers: peersRef,
      publish: (state) =>
        Effect.sync(() => {
          published.push(state);
        }),
    },
    errors: Stream.empty,
    close: Effect.sync(() => {
      closed = true;
    }),
  };

  return {
    document,
    published,
    setPeers: (next: RemotePresence[]) =>
      Effect.runPromise(SubscriptionRef.set(peersRef, next)),
    wasClosed: () => closed,
  };
};

const peersOf = (document: Pick<ConvergentDocument, 'presence'>) =>
  Effect.runPromise(SubscriptionRef.get(document.presence.peers)).then(
    (peers) => peers.map((peer): string => peer.participant.name)
  );

const waitFor = async (condition: () => Promise<boolean>) => {
  const deadline = Date.now() + 2_000;
  while (!(await condition())) {
    if (Date.now() > deadline) throw new Error('condition not met in time');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
};

describe('switchable convergent document presence', () => {
  it('shows the peers of the document it runs on', async () => {
    const first = await createFakeDocument('one', [remote('Alice')]);
    const switchable = await Effect.runPromise(
      createSwitchableDocument({ initial: first.document })
    );

    expect(await peersOf(switchable)).toEqual(['Alice']);

    await first.setPeers([remote('Alice'), remote('Bob')]);
    await waitFor(async () => (await peersOf(switchable)).length === 2);
  });

  it('publishes to the current document', async () => {
    const first = await createFakeDocument('one', []);
    const switchable = await Effect.runPromise(
      createSwitchableDocument({ initial: first.document })
    );

    await Effect.runPromise(switchable.presence.publish(local));

    expect(first.published).toEqual([local]);
  });

  it('says again what it last published to the document it switches to', async () => {
    const first = await createFakeDocument('one', []);
    const second = await createFakeDocument('two', [remote('Carol')]);
    const switchable = await Effect.runPromise(
      createSwitchableDocument({ initial: first.document })
    );
    await Effect.runPromise(switchable.presence.publish(local));

    await Effect.runPromise(switchable.switchTo(second.document));

    expect(first.wasClosed()).toBe(true);
    expect(second.published).toEqual([local]);
    expect(await peersOf(switchable)).toEqual(['Carol']);
  });

  it('follows only the document it switched to', async () => {
    const first = await createFakeDocument('one', [remote('Alice')]);
    const second = await createFakeDocument('two', []);
    const switchable = await Effect.runPromise(
      createSwitchableDocument({ initial: first.document })
    );

    await Effect.runPromise(switchable.switchTo(second.document));
    expect(await peersOf(switchable)).toEqual([]);

    await first.setPeers([remote('Alice'), remote('Bob')]);
    await second.setPeers([remote('Carol')]);
    await waitFor(async () => (await peersOf(switchable)).includes('Carol'));

    expect(await peersOf(switchable)).toEqual(['Carol']);
  });

  it('publishes nothing to the next document when nothing was published', async () => {
    const first = await createFakeDocument('one', []);
    const second = await createFakeDocument('two', []);
    const switchable = await Effect.runPromise(
      createSwitchableDocument({ initial: first.document })
    );

    await Effect.runPromise(switchable.switchTo(second.document));

    expect(second.published).toEqual([]);
  });
});
