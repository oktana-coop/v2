import * as Effect from 'effect/Effect';
import { z } from 'zod';

import { mapErrorTo } from '../../../../../utils/errors';
import { ValidationError } from '../../errors';
import {
  PRIMARY_RICH_TEXT_REPRESENTATION,
  textRichTextRepresentations,
} from '../representation';
import { CURRENT_SCHEMA_VERSION, type RichTextDocument } from './types';

// A document in the primary representation, whichever the build configures.
const primaryRichTextDocumentSchema = z
  .object({
    schemaVersion: z.number(),
    representation: z.enum(textRichTextRepresentations),
    content: z.string(),
  })
  .refine(
    (doc) => doc.representation === PRIMARY_RICH_TEXT_REPRESENTATION,
    'The document is not in the primary representation'
  )
  .brand('PrimaryRichTextDocument');

export type PrimaryRichTextDocument = z.infer<
  typeof primaryRichTextDocumentSchema
>;

// Labels content already in the primary representation; nothing is converted.
export const primaryRichTextDocument = (
  content: string
): PrimaryRichTextDocument =>
  primaryRichTextDocumentSchema.parse({
    schemaVersion: CURRENT_SCHEMA_VERSION,
    representation: PRIMARY_RICH_TEXT_REPRESENTATION,
    content,
  });

export const parsePrimaryRichTextDocument = (
  doc: RichTextDocument
): Effect.Effect<PrimaryRichTextDocument, ValidationError> =>
  Effect.try({
    try: () => primaryRichTextDocumentSchema.parse(doc),
    catch: mapErrorTo(ValidationError, 'Invalid primary rich-text document'),
  });
