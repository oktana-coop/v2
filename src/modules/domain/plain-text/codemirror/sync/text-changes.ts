import { diff } from '@codemirror/merge';
import { ChangeSet, type ChangeSpec, Text } from '@codemirror/state';

// A detailed diff gives up after this long and falls back to a coarser one,
// so a large, very different text cannot hold up the editor.
const DIFF_TIMEOUT_MS = 50;

// The changes that turn one text into the other, each covering only a region
// that differs, with positions in the first text.
export const changesBetween = ({
  before,
  after,
}: {
  before: string;
  after: string;
}): ChangeSpec[] =>
  diff(before, after, { timeout: DIFF_TIMEOUT_MS }).map((change) => ({
    from: change.fromA,
    to: change.toA,
    insert: after.slice(change.fromB, change.toB),
  }));

const changeSetBetween = ({
  before,
  after,
}: {
  before: string;
  after: string;
}): ChangeSet => ChangeSet.of(changesBetween({ before, after }), before.length);

// Theirs with your changes from the base applied over it, so both hold.
export const mergeText = ({
  base,
  yours,
  theirs,
}: {
  base: string;
  yours: string;
  theirs: string;
}): string => {
  if (yours === base || yours === theirs) {
    return theirs;
  }

  if (theirs === base) {
    return yours;
  }

  return changeSetBetween({ before: base, after: yours })
    .map(changeSetBetween({ before: base, after: theirs }))
    .apply(Text.of(theirs.split('\n')))
    .toString();
};
