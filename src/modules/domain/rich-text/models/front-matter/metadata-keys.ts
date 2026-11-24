import { type InvalidMetadataKeyReason } from '../../errors';

// Why a key can't name a property: it's empty, it ends in `_`, which the
// metadata doesn't keep, or it's one of the existing keys. Null when it can.
export const invalidMetadataKeyReason = ({
  key,
  existingKeys,
}: {
  key: string;
  existingKeys: readonly string[];
}): InvalidMetadataKeyReason | null => {
  if (key.trim() === '') {
    return { type: 'empty' };
  }

  if (key.endsWith('_')) {
    return { type: 'endsInUnderscore' };
  }

  return existingKeys.includes(key) ? { type: 'alreadyExists', key } : null;
};
