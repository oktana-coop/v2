import * as Effect from 'effect/Effect';
import { z } from 'zod';

import { mapErrorTo } from '../../../../utils/errors';
import { ValidationError } from '../errors';

const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);

// Text with `\n` line endings and no byte order mark.
const plainTextSchema = z
  .string()
  .refine((text) => !text.includes('\r'), 'The text holds a carriage return')
  .refine(
    (text) => !text.startsWith(BYTE_ORDER_MARK),
    'The text starts with a byte order mark'
  )
  .brand('PlainText');

export type PlainText = z.infer<typeof plainTextSchema>;

export const parsePlainText = (
  text: string
): Effect.Effect<PlainText, ValidationError, never> =>
  Effect.try({
    try: () => plainTextSchema.parse(text),
    catch: mapErrorTo(ValidationError, 'Invalid plain text'),
  });
