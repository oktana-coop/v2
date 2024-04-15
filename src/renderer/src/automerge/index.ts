import * as Automerge from '@automerge/automerge';

export { repo } from './repo';

export type VersionedDocument = {
  title: Automerge.Doc<string>;
  content: Automerge.Doc<string>;
};
