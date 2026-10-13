import * as Effect from 'effect/Effect';
import { describe, expect, it } from 'vitest';

import { PlainTextValidationErrorTag } from '../errors';
import {
  parsePlainTextParticipantSelection,
  plainTextSelectionsAreSame,
} from './participant-selection';

describe('parsePlainTextParticipantSelection', () => {
  it('reads offsets and the version they are valid in', async () => {
    const selection = await Effect.runPromise(
      parsePlainTextParticipantSelection({ anchor: 2, head: 5, version: 'v1' })
    );

    expect(selection).toEqual({ anchor: 2, head: 5, version: 'v1' });
  });

  it.each([
    { anchor: -1, head: 5, version: 'v1' },
    { anchor: 1.5, head: 5, version: 'v1' },
    { anchor: 2, head: 5 },
    'not a selection',
  ])('refuses %j', async (value) => {
    const failure = await Effect.runPromise(
      Effect.flip(parsePlainTextParticipantSelection(value))
    );

    expect(failure._tag).toBe(PlainTextValidationErrorTag);
  });
});

describe('plainTextSelectionsAreSame', () => {
  it('compares offsets and versions', () => {
    const selection = { anchor: 2, head: 5, version: 'v1' };

    expect(plainTextSelectionsAreSame(selection, { ...selection })).toBe(true);
    expect(
      plainTextSelectionsAreSame(selection, { ...selection, version: 'v2' })
    ).toBe(false);
    expect(plainTextSelectionsAreSame(selection, null)).toBe(false);
    expect(plainTextSelectionsAreSame(null, null)).toBe(true);
  });
});
