import { describe, expect, it } from 'vitest';

import {
  type MetadataEntry,
  type MetadataKeyDiff,
  type MetadataValue,
} from '../../../../../../modules/domain/rich-text';
import { toMetadataDiffRows } from './metadata-diff-rows';

const inlines = (source: string): MetadataValue => ({
  type: 'MetaInlines',
  source,
});

const entry = ({ key, source }: { key: string; source: string }) => ({
  key,
  value: inlines(source),
});

const copied = (key: string): MetadataKeyDiff => ({
  op: 'copy',
  key,
  values: [{ op: 'copy', type: 'MetaInlines', hasChanges: false }],
});

const changed = (key: string): MetadataKeyDiff => ({
  op: 'copy',
  key,
  values: [{ op: 'copy', type: 'MetaInlines', hasChanges: true }],
});

const inserted = (key: string): MetadataKeyDiff => ({
  op: 'insert',
  key,
  values: [{ op: 'insert', type: 'MetaInlines', hasChanges: true }],
});

const deleted = (key: string): MetadataKeyDiff => ({
  op: 'delete',
  key,
  values: [{ op: 'delete', type: 'MetaInlines', hasChanges: true }],
});

const keysAndMarks = (rows: ReturnType<typeof toMetadataDiffRows>) =>
  rows.map(({ key, mark }) => `${key}: ${mark}`);

describe('toMetadataDiffRows', () => {
  it('gives unchanged keys in the order of the after version', () => {
    const before: MetadataEntry[] = [
      entry({ key: 'title', source: 'A' }),
      entry({ key: 'author', source: 'B' }),
    ];
    const after: MetadataEntry[] = [
      entry({ key: 'author', source: 'B' }),
      entry({ key: 'title', source: 'A' }),
    ];

    const rows = toMetadataDiffRows({
      before,
      after,
      metadataDiff: [copied('author'), copied('title')],
    });

    expect(rows).toEqual([
      { mark: 'unchanged', key: 'author', value: inlines('B') },
      { mark: 'unchanged', key: 'title', value: inlines('A') },
    ]);
  });

  it('marks an added key with its value', () => {
    const rows = toMetadataDiffRows({
      before: [entry({ key: 'title', source: 'A' })],
      after: [
        entry({ key: 'title', source: 'A' }),
        entry({ key: 'status', source: 'draft' }),
      ],
      metadataDiff: [inserted('status'), copied('title')],
    });

    expect(rows[1]).toEqual({
      mark: 'added',
      key: 'status',
      value: inlines('draft'),
    });
  });

  it('marks a changed key with its value before and after', () => {
    const rows = toMetadataDiffRows({
      before: [entry({ key: 'title', source: 'Old' })],
      after: [entry({ key: 'title', source: 'New' })],
      metadataDiff: [changed('title')],
    });

    expect(rows).toEqual([
      {
        mark: 'changed',
        key: 'title',
        before: inlines('Old'),
        after: inlines('New'),
      },
    ]);
  });

  it('marks a key whose value changed kind as changed', () => {
    const before: MetadataEntry[] = [entry({ key: 'tags', source: 'draft' })];
    const after: MetadataEntry[] = [
      { key: 'tags', value: { type: 'MetaList', items: [inlines('draft')] } },
    ];

    const rows = toMetadataDiffRows({
      before,
      after,
      metadataDiff: [
        {
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
        },
      ],
    });

    expect(rows).toEqual([
      {
        mark: 'changed',
        key: 'tags',
        before: before[0].value,
        after: after[0].value,
      },
    ]);
  });

  it('places a removed key right after the key before it in the before version', () => {
    const rows = toMetadataDiffRows({
      before: [
        entry({ key: 'title', source: 'A' }),
        entry({ key: 'status', source: 'draft' }),
        entry({ key: 'author', source: 'B' }),
      ],
      after: [
        entry({ key: 'title', source: 'A' }),
        entry({ key: 'author', source: 'B' }),
      ],
      metadataDiff: [copied('author'), deleted('status'), copied('title')],
    });

    expect(keysAndMarks(rows)).toEqual([
      'title: unchanged',
      'status: removed',
      'author: unchanged',
    ]);
    expect(rows[1]).toEqual({
      mark: 'removed',
      key: 'status',
      value: inlines('draft'),
    });
  });

  it('places removed keys with no kept key before them at the top, in their order', () => {
    const rows = toMetadataDiffRows({
      before: [
        entry({ key: 'draft', source: 'yes' }),
        entry({ key: 'status', source: 'draft' }),
        entry({ key: 'title', source: 'A' }),
      ],
      after: [entry({ key: 'title', source: 'A' })],
      metadataDiff: [deleted('draft'), deleted('status'), copied('title')],
    });

    expect(keysAndMarks(rows)).toEqual([
      'draft: removed',
      'status: removed',
      'title: unchanged',
    ]);
  });

  it('places removed keys after a kept key that moved', () => {
    const rows = toMetadataDiffRows({
      before: [
        entry({ key: 'title', source: 'A' }),
        entry({ key: 'status', source: 'draft' }),
        entry({ key: 'author', source: 'B' }),
      ],
      after: [
        entry({ key: 'author', source: 'B' }),
        entry({ key: 'title', source: 'A' }),
      ],
      metadataDiff: [copied('author'), deleted('status'), copied('title')],
    });

    expect(keysAndMarks(rows)).toEqual([
      'author: unchanged',
      'title: unchanged',
      'status: removed',
    ]);
  });
});
