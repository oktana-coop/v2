import { next as Automerge } from '@automerge/automerge/slim';
import {
  decodeHeads,
  type DocHandle as AutomergeDocHandle,
  type DocHandleChangePayload as AutomergeDocHandleChangePayload,
  type UrlHeads,
} from '@automerge/automerge-repo/slim';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';

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
  lastCommit: Commit | null;
  lastCommitDoc: VersionedDocument | null;
};

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

  const currentDoc = await documentHandle.doc();

  if (lastCommit) {
    const lastCommitDoc = await getDocumentAtCommit(currentDoc)(
      lastCommit.heads
    );

    return headsAreSame(latestChange.heads, lastCommit.heads) ||
      isContentSame(currentDoc, lastCommitDoc)
      ? {
          history: orderedCommits,
          currentDoc,
          lastCommit,
          lastCommitDoc,
        }
      : {
          history: [latestChange, ...orderedCommits],
          currentDoc,
          lastCommit,
          lastCommitDoc,
        };
  }

  return {
    history: [latestChange],
    currentDoc,
    lastCommit: null,
    lastCommitDoc: null,
  };
};

export const isContentSameAtHeads = async (
  documentHandle: VersionedDocumentHandle,
  heads1: UrlHeads,
  heads2: UrlHeads
) => {
  const doc = await documentHandle.doc();

  const doc1 = await getDocumentAtCommit(doc)(heads1);
  const doc2 = await getDocumentAtCommit(doc)(heads2);

  return isContentSame(doc1, doc2);
};

export const getSpansString = (document: VersionedDocument) => {
  const spans = getSpans(document);
  return sortKeysAndStrinfigy(spans);
};

export const convertToStorageFormat = getSpansString;

const hashDocumentContent = (document: VersionedDocument): string => {
  const spansString = getSpansString(document);
  const spansBytes = utf8ToBytes(spansString);
  const hash = sha256.create().update(spansBytes).digest();
  return bytesToHex(hash);
};

export const isContentSame = (
  doc1: VersionedDocument,
  doc2: VersionedDocument
) => hashDocumentContent(doc1) === hashDocumentContent(doc2);

export type DocHandleChangePayload<T> = AutomergeDocHandleChangePayload<T>;
