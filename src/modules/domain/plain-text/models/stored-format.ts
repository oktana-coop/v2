import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import type { ValueOf } from 'type-fest';
import { z } from 'zod';

import { mapErrorTo } from '../../../../utils/errors';
import { ValidationError } from '../errors';

const LF = '\n';
const CRLF = '\r\n';

export const lineEndings = {
  LF,
  CRLF,
} as const;

export type LineEnding = ValueOf<typeof lineEndings>;

const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);

// Text with `\n` line endings and no byte order mark.
const normalizedTextSchema = z
  .string()
  .refine((text) => !text.includes('\r'), 'The text holds a carriage return')
  .refine(
    (text) => !text.startsWith(BYTE_ORDER_MARK),
    'The text starts with a byte order mark'
  )
  .brand('NormalizedText');

export type NormalizedText = z.infer<typeof normalizedTextSchema>;

export const parseNormalizedText = (
  text: string
): Effect.Effect<NormalizedText, ValidationError, never> =>
  Effect.try({
    try: () => normalizedTextSchema.parse(text),
    catch: mapErrorTo(ValidationError, 'Invalid normalized text'),
  });

// How a document's text was stored, beyond the text itself.
export type StoredFormat = {
  lineEnding: LineEnding;
  byteOrderMark: boolean;
};

export type NormalizedContent = {
  text: NormalizedText;
  format: StoredFormat;
};

const countMatches = (text: string, pattern: RegExp): number =>
  text.match(pattern)?.length ?? 0;

// Whichever line ending the text uses more often, LF when neither is more
// common, including when the text has no line breaks.
const detectDominantLineEnding = (text: string): LineEnding =>
  countMatches(text, /\r\n/g) > countMatches(text, /(?<!\r)\n/g)
    ? lineEndings.CRLF
    : lineEndings.LF;

export const normalizeStoredContent = (
  content: string
): Effect.Effect<NormalizedContent, ValidationError, never> => {
  const byteOrderMark = content.startsWith(BYTE_ORDER_MARK);
  const withoutMark = byteOrderMark
    ? content.slice(BYTE_ORDER_MARK.length)
    : content;

  return pipe(
    parseNormalizedText(withoutMark.replace(/\r\n?/g, LF)),
    Effect.map((text) => ({
      text,
      format: {
        lineEnding: detectDominantLineEnding(withoutMark),
        byteOrderMark,
      },
    }))
  );
};

export const restoreStoredContent = ({
  text,
  format,
}: NormalizedContent): string =>
  (format.byteOrderMark ? BYTE_ORDER_MARK : '') +
  text.replace(/\n/g, format.lineEnding);
