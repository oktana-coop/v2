import { Username } from '../../../../auth';
import { type ChangeId, type CommitId, urlEncodeChangeId } from './change-id';

// Commit is a special type of an (automerge) change that
// strictly has a message and a time
export type Commit = {
  id: CommitId;
  message: string;
  time: Date;
  author?: {
    username: Username;
  };
};

export type UncommitedChange = {
  id: ChangeId;
  time?: Date;
};

export type Change = Commit | UncommitedChange;

export type ChangeWithUrlInfo = Change & {
  urlEncodedChangeId: string;
};

export type CommitWithUrlInfo = Commit & {
  urlEncodedChangeId: string;
};

export const isCommitWithUrlInfo = (
  change: ChangeWithUrlInfo
): change is CommitWithUrlInfo => 'message' in change;

export const isCommit = (change: Commit | UncommitedChange): change is Commit =>
  'message' in change;

export const urlEncodeChangeIdForChange = (change: Commit | UncommitedChange) =>
  urlEncodeChangeId(change.id);
