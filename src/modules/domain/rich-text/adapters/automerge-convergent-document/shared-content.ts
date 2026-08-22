import { type DocHandle } from '@automerge/automerge-repo/slim';
import * as Effect from 'effect/Effect';
import { z } from 'zod';

import { UnsupportedShareFormatError, ValidationError } from '../../errors';

// The layout and editing discipline of a shared document: version 1 holds the
// markdown source in `content`, spliced as text. A peer that does not know a
// version cannot take part in its changes, so unknown versions are refused
// rather than migrated.
export const SHARE_FORMAT_VERSION = 1;

export const sharedContentSchema = z.object({
  shareFormatVersion: z.literal(SHARE_FORMAT_VERSION),
  content: z.string(),
});

export type SharedContent = z.infer<typeof sharedContentSchema>;

// Peers converge on a document only if they all start from the same bytes,
// so every document starts in this shape — minted once, never re-derived.
export const genesisFor = (content: string): SharedContent => ({
  shareFormatVersion: SHARE_FORMAT_VERSION,
  content,
});

// A document arriving over the network can hold anything, so nothing about
// its shape can be assumed. A version this app does not implement is refused
// rather than edited with the wrong discipline.
export const validateSharedContent = (
  handle: DocHandle<SharedContent>
): Effect.Effect<void, UnsupportedShareFormatError | ValidationError> =>
  Effect.suspend(
    (): Effect.Effect<void, UnsupportedShareFormatError | ValidationError> => {
      const doc: unknown = handle.doc();

      if (sharedContentSchema.safeParse(doc).success) return Effect.void;

      const version = (doc as Partial<SharedContent> | undefined)
        ?.shareFormatVersion;

      return typeof version === 'number' && version !== SHARE_FORMAT_VERSION
        ? Effect.fail(
            new UnsupportedShareFormatError(
              `The shared document uses format version ${version}, this app supports ${SHARE_FORMAT_VERSION}.`
            )
          )
        : Effect.fail(
            new ValidationError('The shared document is not a shared document.')
          );
    }
  );
