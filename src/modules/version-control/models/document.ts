import { next as Automerge } from '@automerge/automerge/slim';

import { versionControlItemTypes } from '../constants/versionControlItemTypes';
import { DocHandle } from './doc-handle';

export type RichTextDocument = {
  type: typeof versionControlItemTypes.RICH_TEXT_DOCUMENT;
  title: string;
  content: string;
};

export type VersionedDocument = Automerge.Doc<RichTextDocument>;

export type VersionedDocumentHandle = DocHandle<RichTextDocument>;

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

export const getSpans = (document: VersionedDocument) => {
  return Automerge.spans(document, ['content']);
};
