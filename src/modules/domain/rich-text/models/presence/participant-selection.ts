import * as Effect from 'effect/Effect';
import { z } from 'zod';

import { mapErrorTo } from '../../../../../utils/errors';
import { type ConvergentDocumentVersion } from '../../../collaboration';
import { ValidationError } from '../../errors';

// A selection as ProseMirror positions, valid in the document version named:
// peers at that version share the same document, so the same positions.
export type ParticipantSelection = {
  anchor: number;
  head: number;
  version: ConvergentDocumentVersion;
};

const participantSelectionSchema: z.ZodType<ParticipantSelection> = z.object({
  anchor: z.number().int().nonnegative(),
  head: z.number().int().nonnegative(),
  version: z.string().max(10_000),
});

export const parseParticipantSelection = (
  value: unknown
): Effect.Effect<ParticipantSelection, ValidationError> =>
  Effect.try({
    try: () => participantSelectionSchema.parse(value),
    catch: mapErrorTo(ValidationError, 'Invalid participant selection'),
  });
export const selectionsAreSame = (
  a: ParticipantSelection | null,
  b: ParticipantSelection | null
) =>
  a === b ||
  (a !== null &&
    b !== null &&
    a.anchor === b.anchor &&
    a.head === b.head &&
    a.version === b.version);
