import {
  type DocHandle,
  Presence as AutomergePresence,
} from '@automerge/automerge-repo/slim';
import { getSomes } from 'effect/Array';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { z } from 'zod';

import { type ValidationError } from '../../errors';
import {
  type LocalPresence,
  type Participant,
  participantSchema,
  type RemotePresence,
} from '../../models';
import { type Presence } from '../../ports';

// A selection as the kind of document's editor puts it: how to read one a
// peer sent, and when two say the same.
export type PresenceSelection<ParticipantSelectionType> = {
  parse: (
    value: unknown
  ) => Effect.Effect<ParticipantSelectionType, ValidationError>;
  areSame: (
    a: ParticipantSelectionType | null,
    b: ParticipantSelectionType | null
  ) => boolean;
};

export type AutomergePresenceDeps<DocumentType, ParticipantSelectionType> = {
  handle: DocHandle<DocumentType>;
  selection: PresenceSelection<ParticipantSelectionType>;
  heartbeatMs?: number;
  peerTtlMs?: number;
};

const HEARTBEAT_MS = 5_000;
// A peer that stops answering is forgotten after three missed heartbeats.
const PEER_TTL_MS = 3 * HEARTBEAT_MS;

// A peer's state can arrive in parts (e.g. participant info without selection).
const peerStateSchema = z.object({
  participant: participantSchema,
  selection: z.unknown().default(null),
});

const participantsAreSame = (a: Participant, b: Participant) =>
  a.name === b.name && a.email === b.email && a.avatarUrl === b.avatarUrl;

export const createPresence = <DocumentType, ParticipantSelectionType>({
  handle,
  selection,
  heartbeatMs = HEARTBEAT_MS,
  peerTtlMs = PEER_TTL_MS,
}: AutomergePresenceDeps<
  DocumentType,
  ParticipantSelectionType
>): Effect.Effect<Presence<ParticipantSelectionType>> =>
  pipe(
    SubscriptionRef.make<
      ReadonlyArray<RemotePresence<ParticipantSelectionType>>
    >([]),
    Effect.map((peers) => {
      const presence = new AutomergePresence<
        LocalPresence<ParticipantSelectionType>,
        DocumentType
      >({ handle });

      const parseSelection = (
        value: unknown
      ): Effect.Effect<ParticipantSelectionType | null, ValidationError> =>
        value === null ? Effect.succeed(null) : selection.parse(value);

      // A peer whose state cannot be read is left out.
      const readPeer = ({
        peerId,
        value,
      }: {
        peerId: string;
        value: unknown;
      }) =>
        pipe(
          Effect.try(() => peerStateSchema.parse(value)),
          Effect.flatMap((state) =>
            pipe(
              parseSelection(state.selection),
              Effect.map(
                (peerSelection): RemotePresence<ParticipantSelectionType> => ({
                  peerId,
                  participant: state.participant,
                  selection: peerSelection,
                })
              )
            )
          ),
          Effect.option
        );

      const readPeers = pipe(
        Effect.suspend(() =>
          Effect.forEach(
            Object.values(presence.getPeerStates().value),
            readPeer
          )
        ),
        Effect.map(getSomes)
      );

      const publishPeers = pipe(
        readPeers,
        Effect.flatMap((read) => SubscriptionRef.set(peers, read))
      );

      const handlePeersChange = () => {
        Effect.runSync(publishPeers);
      };

      presence.on('snapshot', handlePeersChange);
      presence.on('update', handlePeersChange);
      presence.on('goodbye', handlePeersChange);
      presence.on('pruning', handlePeersChange);

      let closed = false;

      const publish = (local: LocalPresence<ParticipantSelectionType>) =>
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

          if (!selection.areSame(announced.selection, local.selection)) {
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

export const createNullPresence = <ParticipantSelectionType>(): Effect.Effect<
  Presence<ParticipantSelectionType>
> =>
  pipe(
    SubscriptionRef.make<
      ReadonlyArray<RemotePresence<ParticipantSelectionType>>
    >([]),
    Effect.map((peers) => ({
      peers,
      publish: () => Effect.void,
      close: Effect.void,
    }))
  );
