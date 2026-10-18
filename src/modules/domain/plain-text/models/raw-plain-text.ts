import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import type { ValueOf } from 'type-fest';
import { z } from 'zod';

import { mapErrorTo } from '../../../../utils/errors';
import { ValidationError } from '../errors';
import { parsePlainText, type PlainText } from './document';

const LF = '\n';
const CRLF = '\r\n';

export const lineEndings = {
  LF,
  CRLF,
} as const;

export type LineEnding = ValueOf<typeof lineEndings>;

const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);

const rawPlainTextSchema = z
  .custom<Uint8Array>((value) => ArrayBuffer.isView(value), 'Expected bytes')
  .refine((bytes) => !bytes.includes(0), 'The content holds a NUL byte')
  .transform((bytes, context) => {
    try {
      return {
        content: new TextDecoder('utf-8', {
          fatal: true,
          ignoreBOM: true,
        }).decode(bytes),
      };
    } catch {
      context.addIssue({
        code: 'custom',
        message: 'The content is not valid UTF-8',
      });
      return z.NEVER;
    }
  });

// The decoded text, line endings and byte order mark included.
export type RawPlainText = z.infer<typeof rawPlainTextSchema>;

export const parseRawPlainText = (
  bytes: Uint8Array
): Effect.Effect<RawPlainText, ValidationError, never> =>
  Effect.try({
    try: () => rawPlainTextSchema.parse(bytes),
    catch: mapErrorTo(ValidationError, 'Invalid raw plain text'),
  });

// What raw plain text holds beyond its plain text.
export type RawPlainTextFormat = {
  lineEnding: LineEnding;
  byteOrderMark: boolean;
};

export type PlainTextAndFormat = {
  text: PlainText;
  format: RawPlainTextFormat;
};

const countMatches = (text: string, pattern: RegExp): number =>
  text.match(pattern)?.length ?? 0;

// Whichever line ending the text uses more often, LF when neither is more
// common, including when the text has no line breaks.
const detectDominantLineEnding = (text: string): LineEnding =>
  countMatches(text, /\r\n/g) > countMatches(text, /(?<!\r)\n/g)
    ? lineEndings.CRLF
    : lineEndings.LF;

export const rawPlainTextToPlainText = ({
  content,
}: RawPlainText): Effect.Effect<PlainTextAndFormat, ValidationError, never> => {
  const byteOrderMark = content.startsWith(BYTE_ORDER_MARK);
  const withoutMark = byteOrderMark
    ? content.slice(BYTE_ORDER_MARK.length)
    : content;

  return pipe(
    parsePlainText(withoutMark.replace(/\r\n?/g, LF)),
    Effect.map((text) => ({
      text,
      format: {
        lineEnding: detectDominantLineEnding(withoutMark),
        byteOrderMark,
      },
    }))
  );
};

export const plainTextToRawPlainText = ({
  text,
  format,
}: PlainTextAndFormat): RawPlainText => ({
  content:
    (format.byteOrderMark ? BYTE_ORDER_MARK : '') +
    text.replace(/\n/g, format.lineEnding),
});
