import * as Either from 'effect/Either';

import {
  type InvalidMetadataKeyReason,
  invalidMetadataKeyReason,
} from '../../../../../../modules/domain/rich-text';
import { type Validate } from '../use-text-draft';

export const clearedMessage = 'Use Remove to delete the property';

export const invalidKeyMessage = (reason: InvalidMetadataKeyReason): string => {
  switch (reason.type) {
    case 'empty':
      return 'A property needs a name';
    case 'endsInUnderscore':
      return "Names ending in _ aren't kept";
    case 'alreadyExists':
      return `There's already a property named “${reason.key}”`;
  }
};

export const validateValue: Validate = (text) =>
  text.trim() === '' ? Either.left(clearedMessage) : Either.right(text);

// A property's new name, trimmed, with the model's rules for keys.
export const validateKey =
  (otherKeys: string[]): Validate =>
  (text) => {
    const key = text.trim();
    const reason = invalidMetadataKeyReason({ key, existingKeys: otherKeys });

    return reason === null
      ? Either.right(key)
      : Either.left(invalidKeyMessage(reason));
  };
