// @vitest-environment node
import { Repo } from '@automerge/automerge-repo';
import { MessageChannelNetworkAdapter } from '@automerge/automerge-repo-network-messagechannel';
import * as Effect from 'effect/Effect';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { parseUsername } from '../../../../auth';
import { ValidationError } from '../../errors';
import { type LocalPresence } from '../../models';
import { type Presence } from '../../ports';
import { createNullPresence, createPresence } from './index';

type TestDocument = { content: string };

const seed = (content: string): TestDocument => ({ content });

// A selection of the tests' own: positions and the version they were taken at.
type TestSelection = { anchor: number; head: number; version: string };

const testSelectionSchema = z.object({
  anchor: z.number().int().nonnegative(),
  head: z.number().int().nonnegative(),
  version: z.string(),
});

const selection = {
  parse: (value: unknown) =>
    Effect.try({
      try: () => testSelectionSchema.parse(value),
      catch: () => new ValidationError('Invalid selection'),
    }),
  areSame: (a: TestSelection | null, b: TestSelection | null) =>
    JSON.stringify(a) === JSON.stringify(b),
};

const alice: LocalPresence<TestSelection> = {
  participant: { name: parseUsername('Alice'), email: null, avatarUrl: null },
  selection: null,
};

const bob: LocalPresence<TestSelection> = {
  participant: { name: parseUsername('Bob'), email: null, avatarUrl: null },
  selection: { anchor: 1, head: 3, version: 'v1' },
};

const peersOf = (presence: Presence<TestSelection>) =>
  Effect.runPromise(SubscriptionRef.get(presence.peers));

const namesOf = (presence: Presence<TestSelection>) =>
  peersOf(presence).then((peers) =>
    peers.map((peer): string => peer.participant.name).sort()
  );

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const waitFor = async (
  condition: () => Promise<boolean>,
  timeoutMs = 5_000
) => {
  const deadline = Date.now() + timeoutMs;
  while (!(await condition())) {
    if (Date.now() > deadline) throw new Error('condition not met in time');
    await sleep(20);
  }
};

// Two peers on one document, connected directly, with fast heartbeats so a
// forgotten peer shows up within a test's patience.
const openOnBoth = async () => {
  const channel = new MessageChannel();
  const aliceRepo = new Repo({
    network: [new MessageChannelNetworkAdapter(channel.port1)],
  });
  const bobRepo = new Repo({
    network: [new MessageChannelNetworkAdapter(channel.port2)],
  });

  const aliceHandle = aliceRepo.create<TestDocument>(seed('hello'));
  const bobHandle = await bobRepo.find<TestDocument>(aliceHandle.url);

  const timing = { heartbeatMs: 50, peerTtlMs: 150 };
  const atAlice = await Effect.runPromise(
    createPresence({ handle: aliceHandle, selection, ...timing })
  );
  const atBob = await Effect.runPromise(
    createPresence({ handle: bobHandle, selection, ...timing })
  );

  return { channel, aliceHandle, bobHandle, atAlice, atBob };
};

describe('automerge presence', () => {
  it('shows each peer what the other published', async () => {
    const { atAlice, atBob } = await openOnBoth();

    await Effect.runPromise(atAlice.publish(alice));
    await Effect.runPromise(atBob.publish(bob));

    await waitFor(async () => (await namesOf(atAlice)).includes('Bob'));
    await waitFor(async () => (await namesOf(atBob)).includes('Alice'));

    const [seenByAlice] = await peersOf(atAlice);
    expect(seenByAlice.participant).toEqual(bob.participant);
    expect(seenByAlice.selection).toEqual(bob.selection);
  });

  it('passes on what a peer publishes later', async () => {
    const { atAlice, atBob } = await openOnBoth();

    await Effect.runPromise(atAlice.publish(alice));
    await Effect.runPromise(atBob.publish(bob));
    await waitFor(async () => (await namesOf(atAlice)).includes('Bob'));

    await Effect.runPromise(
      atBob.publish({
        ...bob,
        selection: { anchor: 5, head: 5, version: 'v2' },
      })
    );

    await waitFor(async () => {
      const [seen] = await peersOf(atAlice);
      return seen?.selection?.anchor === 5;
    });
  });

  it('forgets a peer that closed, at once', async () => {
    const { atAlice, atBob } = await openOnBoth();

    await Effect.runPromise(atAlice.publish(alice));
    await Effect.runPromise(atBob.publish(bob));
    await waitFor(async () => (await namesOf(atAlice)).includes('Bob'));

    await Effect.runPromise(atBob.close);

    await waitFor(async () => (await namesOf(atAlice)).length === 0, 500);
  });

  it('forgets a peer that went silent', async () => {
    const { channel, atAlice, atBob } = await openOnBoth();

    await Effect.runPromise(atAlice.publish(alice));
    await Effect.runPromise(atBob.publish(bob));
    await waitFor(async () => (await namesOf(atAlice)).includes('Bob'));

    channel.port2.close();

    await waitFor(async () => (await namesOf(atAlice)).length === 0);
  });

  it('is not fooled by state that does not describe a participant', async () => {
    const { atAlice, bobHandle } = await openOnBoth();

    await Effect.runPromise(atAlice.publish(alice));

    // The wire envelope, sent by hand: a peer with an empty name.
    bobHandle.broadcast({
      __presence: {
        type: 'snapshot',
        state: { participant: { name: '   ', email: null, avatarUrl: null } },
      },
    });

    await sleep(200);
    expect(await peersOf(atAlice)).toEqual([]);
  });

  it('is not fooled by a selection the kind of document cannot read', async () => {
    const { atAlice, bobHandle } = await openOnBoth();

    await Effect.runPromise(atAlice.publish(alice));

    // The wire envelope, sent by hand: a selection at a negative position.
    bobHandle.broadcast({
      __presence: {
        type: 'snapshot',
        state: {
          participant: { name: 'Bob', email: null, avatarUrl: null },
          selection: { anchor: -1, head: 3, version: 'v1' },
        },
      },
    });

    await sleep(200);
    expect(await peersOf(atAlice)).toEqual([]);
  });

  it('only shows avatars from the trusted host', async () => {
    const { atAlice, atBob } = await openOnBoth();

    await Effect.runPromise(atAlice.publish(alice));
    await Effect.runPromise(
      atBob.publish({
        ...bob,
        participant: {
          name: parseUsername('Bob'),
          email: null,
          avatarUrl: 'https://evil.example/avatar.png',
        },
      })
    );
    await waitFor(async () => (await namesOf(atAlice)).includes('Bob'));

    const [seen] = await peersOf(atAlice);
    expect(seen.participant.avatarUrl).toBeNull();

    const trusted = 'https://avatars.githubusercontent.com/u/1?v=4';
    await Effect.runPromise(
      atBob.publish({
        ...bob,
        participant: {
          name: parseUsername('Bob'),
          email: null,
          avatarUrl: trusted,
        },
      })
    );

    await waitFor(async () => {
      const [peer] = await peersOf(atAlice);
      return peer?.participant.avatarUrl === trusted;
    });
  });
});

describe('null presence', () => {
  it('has no peers and takes publishes in stride', async () => {
    const presence =
      await Effect.runPromise(createNullPresence<TestSelection>());

    await Effect.runPromise(presence.publish(alice));

    expect(await peersOf(presence)).toEqual([]);
  });
});
