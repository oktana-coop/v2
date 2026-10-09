import * as Effect from 'effect/Effect';
import { z } from 'zod';

import { ValidationError } from '../errors';

const plainTextDocumentSchema = z
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

export type PlainTextDocument = z.infer<typeof plainTextDocumentSchema>;

export const parsePlainTextDocument = (
  bytes: Uint8Array
): Effect.Effect<PlainTextDocument, ValidationError, never> => {
  const result = plainTextDocumentSchema.safeParse(bytes);

  return result.success
    ? Effect.succeed(result.data)
    : Effect.fail(
        new ValidationError(
          result.error.issues.map((issue) => issue.message).join('. ')
        )
      );
};
