import { describe, expect, it } from 'vitest';

import { invalidMetadataKeyReason } from './metadata-keys';

const existingKeys = ['title'];

describe('invalidMetadataKeyReason', () => {
  it('takes a name none of the existing keys has', () => {
    expect(
      invalidMetadataKeyReason({ key: 'subtitle', existingKeys })
    ).toBeNull();
  });

  it.each(['', '  '])('finds %j empty', (key) => {
    expect(invalidMetadataKeyReason({ key, existingKeys })).toEqual({
      type: 'empty',
    });
  });

  it('finds a name ending in _', () => {
    expect(invalidMetadataKeyReason({ key: 'draft_', existingKeys })).toEqual({
      type: 'endsInUnderscore',
    });
  });

  it('finds one of the existing keys', () => {
    expect(invalidMetadataKeyReason({ key: 'title', existingKeys })).toEqual({
      type: 'alreadyExists',
      key: 'title',
    });
  });
});
