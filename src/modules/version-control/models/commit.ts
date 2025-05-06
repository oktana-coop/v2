import { next as Automerge } from '@automerge/automerge/slim';
import { type UrlHeads } from '@automerge/automerge-repo/slim';
import deepEqual from 'fast-deep-equal';

// Commit is a special type of an (automerge) change that
// strictly has a message and a time
export type Commit = {
  hash: string;
  heads: UrlHeads;
  message: string;
  time: Date;
};

export type UncommitedChange = Omit<Commit, 'message'> & {
  message: undefined;
};

export type Change = Commit | UncommitedChange;

export type ChangeWithUrlInfo = Change & {
  urlEncodedHeads: string;
};

// this is a TS type guard to check if a change is a commit
export const isCommit = (
  change: Commit | UncommitedChange
): change is Commit => {
  // we make the rules!
  return Boolean(change.message);
};

export type CommittedChange = Automerge.DecodedChange & {
  message: string;
};

export const isCommittedChange = (
  change: Automerge.DecodedChange
): change is CommittedChange => {
  return Boolean(change.message);
};

export const encodeURLHeads = (heads: UrlHeads): string =>
  encodeURIComponent(JSON.stringify(heads));

export const encodeURLHeadsForChange = (change: Commit | UncommitedChange) =>
  encodeURLHeads(change.heads);

export const decodeURLHeads = (urlHeads: string): UrlHeads | null => {
  try {
    const parsedHeads = JSON.parse(decodeURIComponent(urlHeads));
    return parsedHeads;
  } catch (e) {
    console.error('Failed to decode URL heads:', e);
    return null;
  }
};

export { type UrlHeads } from '@automerge/automerge-repo/slim';

export const headsAreSame = (a: UrlHeads, b: UrlHeads) => {
  return deepEqual(a, b);
};
