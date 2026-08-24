import { type DocHandle } from '@automerge/automerge-repo/slim';
import * as Effect from 'effect/Effect';
import { z } from 'zod';

import { UnsupportedDocumentFormatError, ValidationError } from '../../errors';

// The shape every Automerge document this app writes takes, private or
// shared alike, and the version of that shape. The version matters when
// documents meet: a peer that does not know a format cannot take part in its
// changes.
export const DOCUMENT_FORMAT_VERSION = 1;

export const documentContentSchema = z.object({
  formatVersion: z.number(),
  content: z.string(),
});

export type DocumentContent = z.infer<typeof documentContentSchema>;

// The same shape, read as far as the version and no further: a document from
// a later format may hold nothing else this app would recognize.
const formatSchema = documentContentSchema.pick({ formatVersion: true });

// Peers converge on a document only if they all start from the same bytes,
// so every document starts in this shape — minted once, never re-derived.
export const initialDocumentContent = (content: string): DocumentContent => ({
  formatVersion: DOCUMENT_FORMAT_VERSION,
  content,
});

// A document this app did not write can hold anything, so nothing about its
// shape can be assumed. A version this app does not implement yields an
// error.
export const validateDocumentContent = (
  handle: DocHandle<DocumentContent>
): Effect.Effect<void, UnsupportedDocumentFormatError | ValidationError> =>
  Effect.suspend(
    (): Effect.Effect<
      void,
      UnsupportedDocumentFormatError | ValidationError
    > => {
      const doc: unknown = handle.doc();

      // Check the version first because newer versions may also change the
      // content schema.
      const formatParsingResult = formatSchema.safeParse(doc);

      if (!formatParsingResult.success) {
        return Effect.fail(
          new ValidationError('No or invalid version in the document.')
        );
      }

      const version = formatParsingResult.data.formatVersion;

      // A version this app does not implement is refused rather than migrated.
      if (version !== DOCUMENT_FORMAT_VERSION) {
        return Effect.fail(
          new UnsupportedDocumentFormatError(
            `The document is written in format ${version}; this app implements ${DOCUMENT_FORMAT_VERSION}.`
          )
        );
      }

      return documentContentSchema.safeParse(doc).success
        ? Effect.void
        : Effect.fail(
            new ValidationError(
              `The document does not hold what format ${DOCUMENT_FORMAT_VERSION} describes.`
            )
          );
    }
  );
