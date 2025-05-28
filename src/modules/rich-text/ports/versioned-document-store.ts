import * as Effect from 'effect/Effect';

import type {
  Commit,
  VersionControlId,
} from '../../../modules/version-control';
import { NotFoundError, RepositoryError } from '../errors';
import type {
  RichTextDocumentSpan,
  VersionedDocument,
  VersionedDocumentHandle,
} from '../models';

export type CreateDocumentArgs = {
  title: string;
  name: string;
  path: string;
  content: string | null;
  projectId: VersionControlId | null;
};

export type GetDocumentHandleAtCommitArgs = {
  documentHandle: VersionedDocumentHandle;
  heads: Commit['heads'];
};

export type UpdateDocumentSpansArgs = {
  documentHandle: VersionedDocumentHandle;
  spans: Array<RichTextDocumentSpan>;
};

export type VersionedDocumentStore = {
  createDocument: (
    args: CreateDocumentArgs
  ) => Effect.Effect<VersionControlId, RepositoryError, never>;
  getDocumentHandleAtCommit: (
    args: GetDocumentHandleAtCommitArgs
  ) => Effect.Effect<VersionedDocumentHandle, RepositoryError, never>;
  findDocumentById: (
    id: VersionControlId
  ) => Effect.Effect<
    VersionedDocumentHandle,
    RepositoryError | NotFoundError,
    never
  >;
  getDocumentFromHandle: (
    handle: VersionedDocumentHandle
  ) => Effect.Effect<VersionedDocument, RepositoryError | NotFoundError, never>;
  // TODO: Think of a better abstraction - this is too Automerge-specific
  updateDocumentSpans: (
    args: UpdateDocumentSpansArgs
  ) => Effect.Effect<void, RepositoryError | NotFoundError, never>;
};
