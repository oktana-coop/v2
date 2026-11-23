import {
  hasChanges,
  type MetadataEntry,
  type MetadataKeyDiff,
  type MetadataValue,
} from '../../../../../modules/domain/rich-text';

export type MetadataDiffRow =
  | {
      mark: 'unchanged' | 'added' | 'removed';
      key: string;
      value: MetadataValue;
    }
  | {
      mark: 'changed';
      key: string;
      before: MetadataValue;
      after: MetadataValue;
    };

type RemovedRowsPlacement = {
  // The last key so far that the after version still holds.
  lastKeptKey: string | null;
  // Under `null`, the removed rows that come before any kept key.
  removedRowsAfterKey: Map<string | null, MetadataDiffRow[]>;
};

// The row of an entry from the after version.
const afterRow = ({
  entry,
  keyDiff,
  beforeValue,
}: {
  entry: MetadataEntry;
  keyDiff: MetadataKeyDiff | undefined;
  beforeValue: MetadataValue | undefined;
}): MetadataDiffRow => {
  const { key, value } = entry;

  if (!keyDiff || !hasChanges(keyDiff)) {
    return { mark: 'unchanged', key, value };
  }

  if (keyDiff.op === 'insert' || beforeValue === undefined) {
    return { mark: 'added', key, value };
  }

  return { mark: 'changed', key, before: beforeValue, after: value };
};

// Rows in the after version's order, each removed key right after the
// nearest key before it that the after version still holds.
export const toMetadataDiffRows = ({
  before,
  after,
  metadataDiff,
}: {
  before: MetadataEntry[];
  after: MetadataEntry[];
  metadataDiff: MetadataKeyDiff[];
}): MetadataDiffRow[] => {
  const keyDiffs = new Map(metadataDiff.map((diff) => [diff.key, diff]));
  const beforeValues = new Map(before.map(({ key, value }) => [key, value]));
  const afterKeys = new Set(after.map(({ key }) => key));

  const { removedRowsAfterKey } = before.reduce<RemovedRowsPlacement>(
    (placement, { key, value }) => {
      if (afterKeys.has(key)) {
        placement.lastKeptKey = key;
        return placement;
      }

      if (keyDiffs.get(key)?.op === 'delete') {
        const rows =
          placement.removedRowsAfterKey.get(placement.lastKeptKey) ?? [];
        rows.push({ mark: 'removed', key, value });
        placement.removedRowsAfterKey.set(placement.lastKeptKey, rows);
      }

      return placement;
    },
    { lastKeptKey: null, removedRowsAfterKey: new Map() }
  );

  return [
    // The removed rows that come before any kept key.
    ...(removedRowsAfterKey.get(null) ?? []),
    // Each entry's row, then the removed rows placed after its key.
    ...after.flatMap((entry) => [
      afterRow({
        entry,
        keyDiff: keyDiffs.get(entry.key),
        beforeValue: beforeValues.get(entry.key),
      }),
      ...(removedRowsAfterKey.get(entry.key) ?? []),
    ]),
  ];
};
