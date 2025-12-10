import * as Effect from 'effect/Effect';
import { z } from 'zod';

import { mapErrorTo } from '../../../utils/errors';
import { ValidationError } from '../errors';

const emailSchema = z.email().brand('Email');

export type Email = z.infer<typeof emailSchema>;

export const parseEmail = (input: string) => emailSchema.parse(input);

export const parseEmailEffect = (input: string) =>
  Effect.try({
    try: () => parseEmail(input),
    catch: mapErrorTo(ValidationError, 'Invalid email'),
  });
