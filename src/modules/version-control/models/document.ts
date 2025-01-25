import { next as Automerge } from '@automerge/automerge/slim';
import { UrlHeads } from '@automerge/automerge-repo/slim';

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
export type Commit = UncommitedChange & {
  message: string;
  time: Date;
};

export type UncommitedChange = {
  hash: string;
  heads: UrlHeads;
};

// this is a TS type guard to check if a change is a commit
export const isCommit = (
  change: Commit | UncommitedChange
): change is Commit => {
  // we make the rules!
  return 'message' in change;
};

type CommittedChange = Automerge.DecodedChange & {
  message: string;
};
const isCommittedChange = (
  change: Automerge.DecodedChange | undefined
): change is CommittedChange => {
  return change ? !!change.message : false;
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

// TODO: thing about this and the above.
// Don't particularly like that we have to expose this and
// the above. Tha fact that's a handle is a technical details
// that should not really bother the rest of the app.
export const getDocumentHandleAtCommit =
  (documentHandle: VersionedDocumentHandle) =>
  (heads: UrlHeads): VersionedDocumentHandle => {
    return documentHandle.view(heads);
  };

export const getDocumentHandleHistory = (
  documentHandle: VersionedDocumentHandle
): Array<UncommitedChange | Commit> => {
  const history = documentHandle.history() || [];
  const changes = history
    .map((heads) => {
      const [head] = heads;
      const changeMetadata = documentHandle.metadata(head);
      return changeMetadata
        ? {
            ...changeMetadata,
            heads: heads,
          }
        : null;
    })
    .filter((change) => change !== null);
  const [latestChangeMeta] = changes.slice(-1);
  const latestChange = {
    hash: latestChangeMeta.hash,
    heads: latestChangeMeta.heads,
  } as UncommitedChange;

  const commits = changes.filter(isCommittedChange).map((change) => ({
    hash: change.hash,
    // TODO: cannot see why hash & heads are different things!
    heads: change.heads,
    message: change.message,
    time: new Date(change.time),
  })) as Array<Commit>;

  const orderedCommits = commits.reverse();
  const [lastCommit] = orderedCommits;

  const commitsAndUncommittedChanges =
    latestChange.hash !== lastCommit.hash
      ? [latestChange, ...orderedCommits]
      : orderedCommits;
  return commitsAndUncommittedChanges;
};

export const convertToStorageFormat = (document: VersionedDocument) =>
  JSON.stringify(getSpans(document));
