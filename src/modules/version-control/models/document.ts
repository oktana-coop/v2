import { next as Automerge } from '@automerge/automerge/slim';
import {
  type DocHandle as AutomergeDocHandle,
  type DocHandleChangePayload as AutomergeDocHandleChangePayload,
} from '@automerge/automerge-repo/slim';

import { versionControlItemTypes } from '../constants/version-control-item-types';
import {
  type Commit,
  isCommittedChange,
  type UncommitedChange,
} from './commit';

export type RichTextDocumentSpan = Automerge.Span;

export type RichTextDocument = {
  type: typeof versionControlItemTypes.RICH_TEXT_DOCUMENT;
  title: string;
  content: string;
};

export type VersionedDocument = Automerge.Doc<RichTextDocument>;

export type VersionedDocumentHandle = AutomergeDocHandle<RichTextDocument>;

export type VersionedDocumentPatch = Automerge.Patch;

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

// TODO: Use heads instead of hashes
export const getDiff = async (
  documentHandle: VersionedDocumentHandle,
  before: string,
  after: string
): Promise<Array<VersionedDocumentPatch> | null> => {
  const document = await documentHandle.doc();
  if (document) {
    const patches = Automerge.diff(document, [before], [after]);
    return patches;
  }

  return null;
};

export const getDiffFromPreviousCommit =
  (documentHandle: VersionedDocumentHandle) =>
  async (
    current: UncommitedChange | Commit
  ): Promise<Array<VersionedDocumentPatch> | null> => {
    const history = getDocumentHandleHistory(documentHandle);
    const currentChangeIndex = history.findIndex(
      (item) => item.hash === current.hash
    );

    const previousChange = history[currentChangeIndex + 1];

    const document = await documentHandle.doc();
    if (document) {
      const patches = Automerge.diff(
        document,
        [previousChange.hash],
        [current.hash]
      );

      return patches;
    }

    return null;
  };

export const getDocumentHandleHistory = (
  documentHandle: VersionedDocumentHandle
): Array<UncommitedChange | Commit> => {
  const history = documentHandle.history() || [];
  const changes = history
    .map((heads) => {
      const [head] = heads;
      // TODO: .metadata is "hidden", and prone to changes or even removal
      // but was the only way to construct the commit graph
      // (history of changes with messages & time)
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
    time: new Date(latestChangeMeta.time),
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

  if (lastCommit) {
    const commitsAndUncommittedChanges =
      latestChange.hash !== lastCommit.hash
        ? [latestChange, ...orderedCommits]
        : orderedCommits;
    return commitsAndUncommittedChanges;
  }

  return [latestChange];
};

export const convertToStorageFormat = (document: VersionedDocument) =>
  JSON.stringify(getSpans(document));

export type DocHandleChangePayload<T> = AutomergeDocHandleChangePayload<T>;
