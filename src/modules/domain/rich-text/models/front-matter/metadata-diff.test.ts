import * as Either from 'effect/Either';
import { describe, expect, it } from 'vitest';

import { ValidationError } from '../../errors';
import {
  hasChanges,
  type MetadataKeyDiff,
  parseMetadataDiff,
} from './metadata-diff';

const unchangedTitle: MetadataKeyDiff = {
  op: 'copy',
  key: 'title',
  values: [{ op: 'copy', type: 'MetaInlines', hasChanges: false }],
};

describe('parseMetadataDiff', () => {
  it('reads key diffs with nested values', () => {
    const value = [
      {
        op: 'copy',
        key: 'tags',
        values: [
          {
            op: 'copy',
            type: 'MetaList',
            items: [{ op: 'insert', type: 'MetaInlines', hasChanges: true }],
          },
        ],
      },
      {
        op: 'copy',
        key: 'draft',
        values: [{ type: 'MetaBoolDiff', before: true, after: false }],
      },
    ];

    expect(Either.getOrThrow(parseMetadataDiff(value))).toEqual(value);
  });

  it('fails with ValidationError for a node of an unknown kind', () => {
    const error = Either.getOrThrow(
      Either.flip(
        parseMetadataDiff([
          {
            op: 'copy',
            key: 'title',
            values: [{ op: 'copy', type: 'MetaNumber', value: 1 }],
          },
        ])
      )
    );

    expect(error).toBeInstanceOf(ValidationError);
  });
});

describe('hasChanges', () => {
  it('is false for a key whose value is copied without changes', () => {
    expect(hasChanges(unchangedTitle)).toBe(false);
  });

  it('is true for a removed key', () => {
    const diff: MetadataKeyDiff = {
      op: 'delete',
      key: 'status',
      values: [{ op: 'delete', type: 'MetaInlines', hasChanges: true }],
    };

    expect(hasChanges(diff)).toBe(true);
  });

  it('is true for a key whose text value changed inside', () => {
    const diff: MetadataKeyDiff = {
      op: 'copy',
      key: 'title',
      values: [{ op: 'copy', type: 'MetaInlines', hasChanges: true }],
    };

    expect(hasChanges(diff)).toBe(true);
  });

  it('is true for a key whose boolean flipped', () => {
    const diff: MetadataKeyDiff = {
      op: 'copy',
      key: 'draft',
      values: [{ type: 'MetaBoolDiff', before: true, after: false }],
    };

    expect(hasChanges(diff)).toBe(true);
  });

  it('is true for a key whose value changed kind', () => {
    const diff: MetadataKeyDiff = {
      op: 'copy',
      key: 'tags',
      values: [
        { op: 'delete', type: 'MetaInlines', hasChanges: true },
        {
          op: 'insert',
          type: 'MetaList',
          items: [{ op: 'insert', type: 'MetaInlines', hasChanges: true }],
        },
      ],
    };

    expect(hasChanges(diff)).toBe(true);
  });

  it('is true for a list with an item added, and false for its copied items', () => {
    const removedItem = {
      op: 'delete',
      type: 'MetaInlines',
      hasChanges: true,
    } as const;
    const copiedItem = {
      op: 'copy',
      type: 'MetaInlines',
      hasChanges: false,
    } as const;
    const diff: MetadataKeyDiff = {
      op: 'copy',
      key: 'tags',
      values: [
        { op: 'copy', type: 'MetaList', items: [removedItem, copiedItem] },
      ],
    };

    expect(hasChanges(diff)).toBe(true);
    expect(hasChanges(removedItem)).toBe(true);
    expect(hasChanges(copiedItem)).toBe(false);
  });

  it('finds a change deep inside nested maps', () => {
    const diff: MetadataKeyDiff = {
      op: 'copy',
      key: 'author',
      values: [
        {
          op: 'copy',
          type: 'MetaMap',
          entries: [
            unchangedTitle,
            {
              op: 'copy',
              key: 'address',
              values: [
                {
                  op: 'copy',
                  type: 'MetaMap',
                  entries: [
                    {
                      op: 'insert',
                      key: 'city',
                      values: [
                        { op: 'insert', type: 'MetaInlines', hasChanges: true },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    expect(hasChanges(diff)).toBe(true);
  });

  it('is false for nested maps copied without changes', () => {
    const diff: MetadataKeyDiff = {
      op: 'copy',
      key: 'author',
      values: [{ op: 'copy', type: 'MetaMap', entries: [unchangedTitle] }],
    };

    expect(hasChanges(diff)).toBe(false);
  });
});
