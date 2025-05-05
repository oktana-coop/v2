import { next as Automerge } from '@automerge/automerge/slim';
import { type UrlHeads } from '@automerge/automerge-repo/slim';

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
