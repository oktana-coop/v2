import type * as Either from 'effect/Either';

import { type InvalidMetadataError } from '../../errors';
import { mergeFrontMatter } from '../../models';

export type FrontMatterChange = { before: string | null; after: string | null };

// The changes undo reverses and those redo makes again, most recent last.
export type MetadataHistory = {
  done: readonly FrontMatterChange[];
  undone: readonly FrontMatterChange[];
};

export type MetadataEditHistoryOperation = 'undo' | 'redo';

const depth = 100;

export const emptyHistory: MetadataHistory = { done: [], undone: [] };

const changesFrontMatter = ({ before, after }: FrontMatterChange): boolean =>
  before !== after;

// Up to `depth` changes; one that changes nothing isn't pushed.
const withPushed = ({
  changes,
  change,
}: {
  changes: readonly FrontMatterChange[];
  change: FrontMatterChange;
}): readonly FrontMatterChange[] =>
  changesFrontMatter(change) ? [...changes, change].slice(-depth) : changes;

export const nextChange = ({
  history,
  operation,
}: {
  history: MetadataHistory;
  operation: MetadataEditHistoryOperation;
}): FrontMatterChange | undefined => {
  const changes = operation === 'undo' ? history.done : history.undone;

  return changes[changes.length - 1];
};

// The front matter with the change reversed, keeping what changed since.
export const reverseChange = ({
  change,
  frontMatter,
}: {
  change: FrontMatterChange;
  frontMatter: string | null;
}): Either.Either<string, InvalidMetadataError> =>
  mergeFrontMatter({
    base: change.after,
    yours: change.before,
    theirs: frontMatter,
  });

// A committed change, which nothing undone can be redone after.
export const withCommit = ({
  history,
  change,
}: {
  history: MetadataHistory;
  change: FrontMatterChange;
}): MetadataHistory =>
  changesFrontMatter(change)
    ? { done: withPushed({ changes: history.done, change }), undone: [] }
    : history;

// The next change of the operation reversed by `change`, which the other
// operation reverses in turn.
export const withReversal = ({
  history,
  operation,
  change,
}: {
  history: MetadataHistory;
  operation: MetadataEditHistoryOperation;
  change: FrontMatterChange;
}): MetadataHistory =>
  operation === 'undo'
    ? {
        done: history.done.slice(0, -1),
        undone: withPushed({ changes: history.undone, change }),
      }
    : {
        done: withPushed({ changes: history.done, change }),
        undone: history.undone.slice(0, -1),
      };

export const withoutNextChange = ({
  history,
  operation,
}: {
  history: MetadataHistory;
  operation: MetadataEditHistoryOperation;
}): MetadataHistory =>
  operation === 'undo'
    ? { ...history, done: history.done.slice(0, -1) }
    : { ...history, undone: history.undone.slice(0, -1) };
