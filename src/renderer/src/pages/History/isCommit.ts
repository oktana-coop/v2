import { default as Automerge } from '@automerge/automerge/next';

export const isCommit = (change: Automerge.DecodedChange) => {
  // we make the rules!
  return Boolean(change.message && change.time);
};
