import { diff } from '@codemirror/merge';
import { type ChangeSpec } from '@codemirror/state';

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
