import * as Effect from 'effect/Effect';
import { z } from 'zod';

import { mapErrorTo } from '../../../utils/errors';
import { ValidationError } from '../errors';

const usernameSchema = z.string().min(1).max(255).brand('Username');

export type Username = z.infer<typeof usernameSchema>;

export const parseUsername = (input: string) => usernameSchema.parse(input);

export const parseUsernameEffect = (input: string) =>
  Effect.try({
    try: () => parseUsername(input),
    catch: mapErrorTo(ValidationError, 'Invalid username'),
  });
