import * as PubSub from 'effect/PubSub';

// The last error is replayed to a subscriber that arrives late.
const REPLAYED_TO_LATE_SUBSCRIBERS = 1;

export const createErrorChannel = <E>() =>
  PubSub.unbounded<E>({ replay: REPLAYED_TO_LATE_SUBSCRIBERS });
