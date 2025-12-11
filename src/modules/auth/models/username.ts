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

export const getInitials = (username: Username): string => {
  const trimmed = username.trim();
  if (!trimmed) return '?';

  const words = trimmed.split(/\s+/);

  // If there's only one word, take the first 2 characters
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  }

  // Take the first letter of the first word and the first letter of the last word
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
};
