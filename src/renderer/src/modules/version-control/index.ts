import * as Automerge from '@automerge/automerge/next';

export { repo } from './repo';

export type VersionedDocument = {
  title: Automerge.Doc<string>;
  content: Automerge.Doc<string>;
};

// Commit is a special type of an (automerge) change that
// strictly has a message and a time
export type Commit = {
  hash: string;
  message: string;
  time: Date;
};
// this is a TS type guard to check if a change is a commit
export const isCommit = (
  change: Automerge.DecodedChange | Commit
): change is Commit => {
  // we make the rules!
  return Boolean(change.message && change.time);
};
