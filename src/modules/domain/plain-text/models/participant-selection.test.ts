import * as Effect from 'effect/Effect';
import { describe, expect, it } from 'vitest';

import { PlainTextValidationErrorTag } from '../errors';
import {
  parseParticipantSelection,
  selectionsAreSame,
} from './participant-selection';

describe('parseParticipantSelection', () => {
  it('reads offsets and the version they are valid in', async () => {
    const selection = await Effect.runPromise(
      parseParticipantSelection({ anchor: 2, head: 5, version: 'v1' })
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
      Effect.flip(parseParticipantSelection(value))
    );

    expect(failure._tag).toBe(PlainTextValidationErrorTag);
  });
});

describe('selectionsAreSame', () => {
  it('compares offsets and versions', () => {
    const selection = { anchor: 2, head: 5, version: 'v1' };

    expect(selectionsAreSame(selection, { ...selection })).toBe(true);
    expect(selectionsAreSame(selection, { ...selection, version: 'v2' })).toBe(
      false
    );
    expect(selectionsAreSame(selection, null)).toBe(false);
    expect(selectionsAreSame(null, null)).toBe(true);
  });
});
