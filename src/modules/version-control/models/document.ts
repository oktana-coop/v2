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
export type Commit = {
  hash: string;
  heads: UrlHeads;
  message: string;
  time: Date;
};

export type UncommitedChange = {
  hash: string;
  heads: UrlHeads;
};

// this is a TS type guard to check if a change is a commit
export const isCommit = (
  change: Automerge.DecodedChange | Commit | undefined
): change is Commit => {
  if (change) {
    // we make the rules!
    return Boolean(change.message && change.time);
  }
  return false;
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
  const [latestChangeHeads] = history.slice(-1);
  const uncommitedChangesMetadata = documentHandle.metadata(
    latestChangeHeads[0]
  ) as Automerge.DecodedChange;
  const uncommitedChange = {
    hash: uncommitedChangesMetadata.hash,
    heads: latestChangeHeads,
  } as UncommitedChange;

  const commits = history
    .map((heads) => {
      const [change] = heads;
      const changeMetadata = documentHandle.metadata(change);
      if (isCommit(changeMetadata)) {
        return {
          hash: changeMetadata.hash,
          // TODO: cannot see why hash & heads are different things!
          heads: heads,
          message: changeMetadata.message,
          time: changeMetadata.time,
        };
      }
      return undefined;
    })
    .filter((change) => !!change);

  const orderedCommits = commits.reverse();
  const [lastCommit] = orderedCommits;

  return uncommitedChange.hash !== lastCommit.hash
    ? [uncommitedChange, ...orderedCommits]
    : orderedCommits;
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
