import { z } from 'zod';

import { type ConvergentDocumentVersion } from '../document';

// A selection as ProseMirror positions, valid in the document version named:
// peers at that version share the same document, so the same positions.
export type ParticipantSelection = {
  anchor: number;
  head: number;
  version: ConvergentDocumentVersion;
};

export const participantSelectionSchema: z.ZodType<ParticipantSelection> =
  z.object({
    anchor: z.number().int().nonnegative(),
    head: z.number().int().nonnegative(),
    version: z.string().max(10_000),
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
