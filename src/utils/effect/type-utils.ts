import * as Effect from 'effect/Effect';

export type EffectErrorType<T> =
  T extends Effect.Effect<unknown, infer E, unknown> ? E : never;
