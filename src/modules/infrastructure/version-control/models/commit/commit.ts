import { type CommitId, urlEncodeCommitId } from './commit-id';

// Commit is a special type of an (automerge) change that
// strictly has a message and a time
export type Commit = {
  id: CommitId;
  message: string;
  time: Date;
};

export type UncommitedChange = Omit<Commit, 'message'> & {
  message: undefined;
};

export type Change = Commit | UncommitedChange;

export type ChangeWithUrlInfo = Change & {
  urlEncodedCommitId: string;
};

// this is a TS type guard to check if a change is a commit
export const isCommit = (
  change: Commit | UncommitedChange
): change is Commit => {
  // we make the rules!
  return Boolean(change.message);
};

export const urlEncodeCommitIdForChange = (change: Commit | UncommitedChange) =>
  urlEncodeCommitId(change.id);
