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
import { subscribeToStream } from '../../../../../utils/effect';
import { parseUsername } from '../../../../auth';
import { markdownDocument, versionOf } from '../test-utils';
import { createSwitchableDocument } from './switchable-convergent-document';

const peer = (name: string): RemotePresence => ({
  peerId: name.toLowerCase(),
  participant: { name: parseUsername(name), email: null, avatarUrl: null },
  selection: null,
});

const localPresence: LocalPresence = {
  participant: { name: parseUsername('Me'), email: null, avatarUrl: null },
  selection: null,
};

const createFakeConvergentDocument = async ({
  name,
  text,
  peers,
}: {
  name: string;
  text: string;
  peers: RemotePresence[];
}) => {
  // Versions carry which document minted them, as heads do.
  const content = await Effect.runPromise(
    SubscriptionRef.make<ConvergentDocumentState>({
      doc: markdownDocument(text),
      version: `${name}.0`,
    })
  );
  const peersRef = await Effect.runPromise(
    SubscriptionRef.make<ReadonlyArray<RemotePresence>>(peers)
  );
  const publishPresence: Mock<ConvergentDocument['presence']['publish']> =
    vi.fn(() => Effect.void);
  const close = vi.fn();

  const document: ConvergentDocument = {
    content,
    change: () => Effect.die('no changes in these tests'),
    presence: { peers: peersRef, publish: publishPresence },
    errors: Stream.empty,
    close: Effect.sync(close),
  };

  return {
    document,
    publishPresence,
    close,
    setPeers: (next: RemotePresence[]) =>
      Effect.runPromise(SubscriptionRef.set(peersRef, next)),
  };
};

const peersOf = (document: Pick<ConvergentDocument, 'presence'>) =>
  Effect.runPromise(SubscriptionRef.get(document.presence.peers)).then(
    (peers) => peers.map((presence): string => presence.participant.name)
  );

describe('switchable convergent document stability', () => {
  it('keeps whoever follows its content bound through a switch', async () => {
    const first = await createFakeConvergentDocument({
      name: 'd0',
      text: 'one',
      peers: [],
    });
    const second = await createFakeConvergentDocument({
      name: 'd1',
      text: 'two',
      peers: [],
    });
    const switchable = await Effect.runPromise(
      createSwitchableDocument({ initial: first.document })
    );
    const contentFollower = vi.fn<(state: ConvergentDocumentState) => void>();
    subscribeToStream(switchable.content.changes, contentFollower);
    await vi.waitFor(() =>
      expect(contentFollower).toHaveBeenCalledWith({
        doc: markdownDocument('one'),
        version: 'd0.0',
      })
    );

    await Effect.runPromise(switchable.switchTo(second.document));

    await vi.waitFor(() =>
      expect(contentFollower).toHaveBeenLastCalledWith({
        doc: markdownDocument('two'),
        version: 'd1.0',
      })
    );
  });

  // Detaching switches to a document started from the same text: followers
  // derive their next base from the version, so it has to change regardless.
  it("shows the next document's version even when its text is the same", async () => {
    const first = await createFakeConvergentDocument({
      name: 'd0',
      text: 'same',
      peers: [],
    });
    const second = await createFakeConvergentDocument({
      name: 'd1',
      text: 'same',
      peers: [],
    });
    const switchable = await Effect.runPromise(
      createSwitchableDocument({ initial: first.document })
    );

    await Effect.runPromise(switchable.switchTo(second.document));

    const version = await versionOf(switchable);
    expect(version).toBe('d1.0');
  });
});

describe('switchable convergent document presence', () => {
  it('shows the peers of the current document', async () => {
    const first = await createFakeConvergentDocument({
      name: 'd0',
      text: 'one',
      peers: [peer('Alice')],
    });
    const switchable = await Effect.runPromise(
      createSwitchableDocument({ initial: first.document })
    );

    const peers = await peersOf(switchable);
    expect(peers).toEqual(['Alice']);

    await first.setPeers([peer('Alice'), peer('Bob')]);
    await vi.waitFor(async () => {
      const updatedPeers = await peersOf(switchable);
      expect(updatedPeers).toEqual(['Alice', 'Bob']);
    });
  });

  it('publishes local presence to the current document', async () => {
    const first = await createFakeConvergentDocument({
      name: 'd0',
      text: 'one',
      peers: [],
    });
    const switchable = await Effect.runPromise(
      createSwitchableDocument({ initial: first.document })
    );

    await Effect.runPromise(switchable.presence.publish(localPresence));

    expect(first.publishPresence).toHaveBeenCalledExactlyOnceWith(
      localPresence
    );
  });

  it('publishes its last local presence again to the document it switches to', async () => {
    const first = await createFakeConvergentDocument({
      name: 'd0',
      text: 'one',
      peers: [],
    });
    const second = await createFakeConvergentDocument({
      name: 'd1',
      text: 'two',
      peers: [peer('Carol')],
    });
    const switchable = await Effect.runPromise(
      createSwitchableDocument({ initial: first.document })
    );
    await Effect.runPromise(switchable.presence.publish(localPresence));

    await Effect.runPromise(switchable.switchTo(second.document));

    expect(first.close).toHaveBeenCalledOnce();
    expect(second.publishPresence).toHaveBeenCalledExactlyOnceWith(
      localPresence
    );
    const peers = await peersOf(switchable);
    expect(peers).toEqual(['Carol']);
  });

  it('follows only the document it switched to', async () => {
    const first = await createFakeConvergentDocument({
      name: 'd0',
      text: 'one',
      peers: [peer('Alice')],
    });
    const second = await createFakeConvergentDocument({
      name: 'd1',
      text: 'two',
      peers: [],
    });
    const switchable = await Effect.runPromise(
      createSwitchableDocument({ initial: first.document })
    );

    await Effect.runPromise(switchable.switchTo(second.document));
    const peersAfterSwitch = await peersOf(switchable);
    expect(peersAfterSwitch).toEqual([]);

    await first.setPeers([peer('Alice'), peer('Bob')]);
    await second.setPeers([peer('Carol')]);

    await vi.waitFor(async () => {
      const peersNow = await peersOf(switchable);
      expect(peersNow).toEqual(['Carol']);
    });
  });

  it('publishes no local presence to the next document when none was published', async () => {
    const first = await createFakeConvergentDocument({
      name: 'd0',
      text: 'one',
      peers: [],
    });
    const second = await createFakeConvergentDocument({
      name: 'd1',
      text: 'two',
      peers: [],
    });
    const switchable = await Effect.runPromise(
      createSwitchableDocument({ initial: first.document })
    );

    await Effect.runPromise(switchable.switchTo(second.document));

    expect(second.publishPresence).not.toHaveBeenCalled();
  });
});
