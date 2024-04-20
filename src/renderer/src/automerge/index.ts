import { default as Automerge } from '@automerge/automerge/next';

export { repo } from './repo';

export type VersionedDocument = {
  title: Automerge.Doc<string>;
  content: Automerge.Doc<string>;
};

export const isCommit = (change: Automerge.DecodedChange) => {
  // we make the rules!
  return Boolean(change.message && change.time);
};
