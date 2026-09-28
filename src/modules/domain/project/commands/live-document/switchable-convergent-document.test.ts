import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { describe, expect, it, type Mock, vi } from 'vitest';

import {
  type ConvergentDocument,
  type ConvergentDocumentState,
  type LocalPresence,
  type RemotePresence,
} from '../../../../../modules/domain/rich-text';
import { parseUsername } from '../../../../auth';
import { markdownDocument } from '../test-utils';
import { createSwitchableDocument } from './switchable-convergent-document';

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
const createFakeDocument = async ({
  text,
  peers,
}: {
  text: string;
  peers: RemotePresence[];
}) => {
  const content = await Effect.runPromise(
    SubscriptionRef.make<ConvergentDocumentState>({
      doc: markdownDocument(text),
      version: `${text}.0`,
    })
  );
  const peersRef = await Effect.runPromise(
    SubscriptionRef.make<ReadonlyArray<RemotePresence>>(peers)
  );
  const publish: Mock<ConvergentDocument['presence']['publish']> = vi.fn(
    () => Effect.void
  );
  const close = vi.fn();

  const document: ConvergentDocument = {
    content,
    change: (next) =>
      Effect.as(
        SubscriptionRef.set(content, {
          doc: markdownDocument(next),
          version: `${next}.1`,
        }),
        `${next}.1`
      ),
    presence: { peers: peersRef, publish },
    errors: Stream.empty,
    close: Effect.sync(close),
  };

  return {
    document,
    publish,
    close,
    setPeers: (next: RemotePresence[]) =>
      Effect.runPromise(SubscriptionRef.set(peersRef, next)),
  };
};

const peersOf = (document: Pick<ConvergentDocument, 'presence'>) =>
  Effect.runPromise(SubscriptionRef.get(document.presence.peers)).then(
    (peers) => peers.map((peer): string => peer.participant.name)
  );

describe('switchable convergent document presence', () => {
  it('shows the peers of the document it runs on', async () => {
    const first = await createFakeDocument({
      text: 'one',
      peers: [remote('Alice')],
    });
    const switchable = await Effect.runPromise(
      createSwitchableDocument({ initial: first.document })
    );

    const peers = await peersOf(switchable);
    expect(peers).toEqual(['Alice']);

    await first.setPeers([remote('Alice'), remote('Bob')]);
    await vi.waitFor(async () => {
      const peersNow = await peersOf(switchable);
      expect(peersNow).toEqual(['Alice', 'Bob']);
    });
  });

  it('publishes to the current document', async () => {
    const first = await createFakeDocument({ text: 'one', peers: [] });
    const switchable = await Effect.runPromise(
      createSwitchableDocument({ initial: first.document })
    );

    await Effect.runPromise(switchable.presence.publish(local));

    expect(first.publish).toHaveBeenCalledExactlyOnceWith(local);
  });

  it('says again what it last published to the document it switches to', async () => {
    const first = await createFakeDocument({ text: 'one', peers: [] });
    const second = await createFakeDocument({
      text: 'two',
      peers: [remote('Carol')],
    });
    const switchable = await Effect.runPromise(
      createSwitchableDocument({ initial: first.document })
    );
    await Effect.runPromise(switchable.presence.publish(local));

    await Effect.runPromise(switchable.switchTo(second.document));

    expect(first.close).toHaveBeenCalledOnce();
    expect(second.publish).toHaveBeenCalledExactlyOnceWith(local);
    const peers = await peersOf(switchable);
    expect(peers).toEqual(['Carol']);
  });

  it('follows only the document it switched to', async () => {
    const first = await createFakeDocument({
      text: 'one',
      peers: [remote('Alice')],
    });
    const second = await createFakeDocument({ text: 'two', peers: [] });
    const switchable = await Effect.runPromise(
      createSwitchableDocument({ initial: first.document })
    );

    await Effect.runPromise(switchable.switchTo(second.document));
    const peersAfterSwitch = await peersOf(switchable);
    expect(peersAfterSwitch).toEqual([]);

    await first.setPeers([remote('Alice'), remote('Bob')]);
    await second.setPeers([remote('Carol')]);

    await vi.waitFor(async () => {
      const peersNow = await peersOf(switchable);
      expect(peersNow).toEqual(['Carol']);
    });
  });

  it('publishes nothing to the next document when nothing was published', async () => {
    const first = await createFakeDocument({ text: 'one', peers: [] });
    const second = await createFakeDocument({ text: 'two', peers: [] });
    const switchable = await Effect.runPromise(
      createSwitchableDocument({ initial: first.document })
    );

    await Effect.runPromise(switchable.switchTo(second.document));

    expect(second.publish).not.toHaveBeenCalled();
  });
});
