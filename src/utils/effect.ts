import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as Option from 'effect/Option';

export const fromNullable = <A, E>(
  value: A | null | undefined,
  onNone: () => E
): Effect.Effect<A, E, never> =>
  pipe(
    Option.fromNullable(value),
    Option.match({
      onNone: () => Effect.fail(onNone()),
      onSome: (val) => Effect.succeed(val),
    })
  );
