import * as Effect from 'effect/Effect';
import * as SubscriptionRef from 'effect/SubscriptionRef';

import { type LocalPresence, type RemotePresence } from '../models';

export type Presence<ParticipantSelectionType> = {
  peers: SubscriptionRef.SubscriptionRef<
    ReadonlyArray<RemotePresence<ParticipantSelectionType>>
  >;
  publish: (
    state: LocalPresence<ParticipantSelectionType>
  ) => Effect.Effect<void>;
  close: Effect.Effect<void>;
};
