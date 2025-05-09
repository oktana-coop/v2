import { next as Automerge } from '@automerge/automerge/slim';
import {
  decodeHeads,
  type DocHandle as AutomergeDocHandle,
  type DocHandleChangePayload as AutomergeDocHandleChangePayload,
  encodeHeads,
  type UrlHeads,
} from '@automerge/automerge-repo/slim';

import { sortKeysAndStrinfigy } from '../../../utils/object';
import { versionControlItemTypes } from '../constants/version-control-item-types';
import {
  type Change,
  type Commit,
  headsAreSame,
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
  (heads: UrlHeads): VersionedDocument => {
    return Automerge.view(document, decodeHeads(heads));
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
    const { history } = await getDocumentHandleHistory(documentHandle);
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

export type GetDocumentHandleHistoryResponse = {
  history: Change[];
  currentDoc: VersionedDocument;
  latestChange: Change;
  lastCommit: Commit | null;
};

export const getDocumentHeads = (document: VersionedDocument): UrlHeads =>
  encodeHeads(Automerge.getHeads(document));

export const getDocumentHandleHistory = async (
  documentHandle: VersionedDocumentHandle
): Promise<GetDocumentHandleHistoryResponse> => {
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
            heads,
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

  const currentDoc = await documentHandle.doc();

  if (lastCommit) {
    return headsAreSame(latestChange.heads, lastCommit.heads) ||
      isContentSameAtHeads(currentDoc, latestChange.heads, lastCommit.heads)
      ? {
          history: orderedCommits,
          currentDoc,
          latestChange,
          lastCommit,
        }
      : {
          history: [latestChange, ...orderedCommits],
          currentDoc,
          latestChange,
          lastCommit,
        };
  }

  return {
    history: [latestChange],
    currentDoc,
    latestChange,
    lastCommit: null,
  };
};

export const isContentSameAtHeads = (
  document: VersionedDocument,
  heads1: UrlHeads,
  heads2: UrlHeads
): boolean => {
  const diff = Automerge.diff(
    document,
    decodeHeads(heads1),
    decodeHeads(heads2)
  );
  return diff.length === 0;
};

export const getSpansString = (document: VersionedDocument) => {
  const spans = getSpans(document);
  return sortKeysAndStrinfigy(spans);
};

export const convertToStorageFormat = getSpansString;

export type DocHandleChangePayload<T> = AutomergeDocHandleChangePayload<T>;
