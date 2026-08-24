import { type DocHandle } from '@automerge/automerge-repo/slim';
import * as Effect from 'effect/Effect';
import { z } from 'zod';

import { UnsupportedShareFormatError, ValidationError } from '../../errors';

export const SHARE_FORMAT_VERSION = 1;

export const sharedContentSchema = z.object({
  shareFormatVersion: z.number(),
  content: z.string(),
});

export type SharedContent = z.infer<typeof sharedContentSchema>;

const shareFormatSchema = sharedContentSchema.pick({
  shareFormatVersion: true,
});

// Peers converge on a document only if they all start from the same bytes,
// so every document starts in this shape — minted once, never re-derived.
export const initialSharedContent = (content: string): SharedContent => ({
  shareFormatVersion: SHARE_FORMAT_VERSION,
  content,
});

// A document arriving over the network can hold anything, so nothing about
// its shape can be assumed. A version this app does not implement yields an error.
export const validateSharedContent = (
  handle: DocHandle<SharedContent>
): Effect.Effect<void, UnsupportedShareFormatError | ValidationError> =>
  Effect.suspend(
    (): Effect.Effect<void, UnsupportedShareFormatError | ValidationError> => {
      const doc: unknown = handle.doc();

      // Check the version first because newer versions may also change the content schema.
      const formatParsingResult = shareFormatSchema.safeParse(doc);

      if (!formatParsingResult.success) {
        return Effect.fail(
          new ValidationError('No or invalid version in the shared document.')
        );
      }

      const version = formatParsingResult.data.shareFormatVersion;

      // A version this app does not implement is refused rather than migrated.
      if (version !== SHARE_FORMAT_VERSION) {
        return Effect.fail(
          new UnsupportedShareFormatError(
            `The shared document is written in format ${version}; this app implements ${SHARE_FORMAT_VERSION}.`
          )
        );
      }

      return sharedContentSchema.safeParse(doc).success
        ? Effect.void
        : Effect.fail(
            new ValidationError(
              `The shared document does not hold what format ${SHARE_FORMAT_VERSION} describes.`
            )
          );
    }
  );
