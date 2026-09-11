import {
  type DocHandle,
  Presence as AutomergePresence,
} from '@automerge/automerge-repo/slim';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { z } from 'zod';

import {
  type LocalPresence,
  type Participant,
  participantSchema,
  participantSelectionSchema,
  type RemotePresence,
  selectionsAreSame,
} from '../../models';
import { type Presence } from '../../ports/convergent-document';

export type AutomergePresenceDeps<T> = {
  handle: DocHandle<T>;
  heartbeatMs?: number;
  peerTtlMs?: number;
};

const HEARTBEAT_MS = 5_000;
// A peer that stops answering is forgotten after three missed heartbeats.
const PEER_TTL_MS = 3 * HEARTBEAT_MS;

const peerStateSchema = z.object({
  participant: participantSchema,
  // A peer's state can arrive in parts (e.g. participant info without selection).
  selection: participantSelectionSchema.nullable().default(null),
});

const participantsAreSame = (a: Participant, b: Participant) =>
  a.name === b.name && a.email === b.email && a.avatarUrl === b.avatarUrl;

export const createPresence = <T>({
  handle,
  heartbeatMs = HEARTBEAT_MS,
  peerTtlMs = PEER_TTL_MS,
}: AutomergePresenceDeps<T>): Effect.Effect<Presence> =>
  pipe(
    SubscriptionRef.make<ReadonlyArray<RemotePresence>>([]),
    Effect.map((peers) => {
      const presence = new AutomergePresence<LocalPresence, T>({ handle });

      const readPeers = (): RemotePresence[] =>
        Object.values(presence.getPeerStates().value).flatMap(
          ({ peerId, value }) => {
            const parsed = peerStateSchema.safeParse(value);

            return parsed.success ? [{ peerId, ...parsed.data }] : [];
          }
        );

      const publishPeers = Effect.suspend(() =>
        SubscriptionRef.set(peers, readPeers())
      );

      const handlePeersChange = () => {
        Effect.runSync(publishPeers);
      };

      presence.on('snapshot', handlePeersChange);
      presence.on('update', handlePeersChange);
      presence.on('goodbye', handlePeersChange);
      presence.on('pruning', handlePeersChange);

      let closed = false;

      const publish = (local: LocalPresence) =>
        Effect.sync(() => {
          if (closed) return;

          if (!presence.running) {
            presence.start({ initialState: local, heartbeatMs, peerTtlMs });
            return;
          }

          // What peers already hold of us.
          const announced = presence.getLocalState();

          if (!participantsAreSame(announced.participant, local.participant)) {
            presence.broadcast('participant', local.participant);
          }

          if (!selectionsAreSame(announced.selection, local.selection)) {
            presence.broadcast('selection', local.selection);
          }
        });

      const close = Effect.sync(() => {
        closed = true;
        presence.stop();
        presence.removeAllListeners();
      });

      return { peers, publish, close };
    })
  );

export const createNullPresence = (): Effect.Effect<Presence> =>
  pipe(
    SubscriptionRef.make<ReadonlyArray<RemotePresence>>([]),
    Effect.map((peers) => ({
      peers,
      publish: () => Effect.void,
      close: Effect.void,
    }))
  );
