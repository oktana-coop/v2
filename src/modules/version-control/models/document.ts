import { next as Automerge } from '@automerge/automerge/slim';

import { versionControlItemTypes } from '../constants/versionControlItemTypes';
import { DocHandle } from './doc-handle';

export type RichTextDocumentSpan = Automerge.Span;

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

// TODO: Use something that is not Automerge-specific
export type DecodedChange = Automerge.DecodedChange;

// this is a TS type guard to check if a change is a commit
export const isCommit = (
  change: Automerge.DecodedChange | Commit
): change is Commit => {
  // we make the rules!
  return Boolean(change.message && change.time);
};

export const getSpans: (
  document: VersionedDocument
) => Array<RichTextDocumentSpan> = (document) => {
  return Automerge.spans(document, ['content']);
};

export const getDocumentAtCommit =
  (document: VersionedDocument) =>
  (hash: string): VersionedDocument => {
    return Automerge.view(document, [hash]);
  };

export const getCommitsAndUncommittedChanges = (
  document: VersionedDocument
) => {
  const allChanges = Automerge.getAllChanges(document);
  const decodedChanges = allChanges.map(Automerge.decodeChange);
  const [latestChange] = decodedChanges.slice(-1);

  const commits = decodedChanges.filter(isCommit).map((change) => ({
    hash: change.hash,
    message: change.message,
    time: new Date(change.time),
  })) as Array<Commit>;

  const orderedCommits = commits.reverse();
  const [lastCommit] = orderedCommits;

  const commitsAndUncommittedChanges =
    latestChange?.hash !== lastCommit?.hash
      ? [latestChange, ...orderedCommits]
      : orderedCommits;

  return commitsAndUncommittedChanges;
};

export const convertToStorageFormat = (document: VersionedDocument) =>
  JSON.stringify(getSpans(document));
