import * as Effect from 'effect/Effect';
import { z } from 'zod';

import { mapErrorTo } from '../../../../utils/errors';
import { type ConvergentDocumentVersion } from '../../collaboration';
import { ValidationError } from '../errors';

// A selection as offsets into the document's text, valid in the document
// version named: peers at that version share the same text, so the same
// offsets.
export type PlainTextParticipantSelection = {
  anchor: number;
  head: number;
  version: ConvergentDocumentVersion;
};

const plainTextParticipantSelectionSchema: z.ZodType<PlainTextParticipantSelection> =
  z.object({
    anchor: z.number().int().nonnegative(),
    head: z.number().int().nonnegative(),
    version: z.string().max(10_000),
  });

export const parsePlainTextParticipantSelection = (
  value: unknown
): Effect.Effect<PlainTextParticipantSelection, ValidationError> =>
  Effect.try({
    try: () => plainTextParticipantSelectionSchema.parse(value),
    catch: mapErrorTo(ValidationError, 'Invalid participant selection'),
  });

export const plainTextSelectionsAreSame = (
  a: PlainTextParticipantSelection | null,
  b: PlainTextParticipantSelection | null
) =>
  a === b ||
  (a !== null &&
    b !== null &&
    a.anchor === b.anchor &&
    a.head === b.head &&
    a.version === b.version);
