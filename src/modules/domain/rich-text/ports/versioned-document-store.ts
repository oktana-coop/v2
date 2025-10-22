import * as Effect from 'effect/Effect';

import {
  type Change,
  type Commit,
  type MigrationError,
  type VersionControlId,
} from '../../../../modules/infrastructure/version-control';
import { RichTextRepresentation } from '../constants';
import { NotFoundError, RepositoryError } from '../errors';
import {
  type VersionedDocument,
  type VersionedDocumentHandle,
} from '../models';

export type CreateDocumentArgs = {
  content: string | null;
};

export type GetDocumentHandleAtCommitArgs = {
  documentHandle: VersionedDocumentHandle;
  heads: Commit['heads'];
};

export type GetDocumentAtCommitArgs = {
  documentId: VersionControlId;
  heads: Commit['heads'];
};

export type UpdateRichTextDocumentContentArgs = {
  documentId: VersionControlId;
  representation: RichTextRepresentation;
  content: string;
};

export type GetDocumentHistoryResponse = {
  history: Change[];
  current: VersionedDocument;
  latestChange: Change;
  lastCommit: Commit | null;
};

export type GetDocumentHandleHistoryResponse = {
  history: Change[];
  current: VersionedDocument;
  latestChange: Change;
  lastCommit: Commit | null;
};

export type IsContentSameAtHeadsArgs = {
  documentId: VersionControlId;
  heads1: Commit['heads'];
  heads2: Commit['heads'];
};

export type CommitChangesArgs = {
  documentId: VersionControlId;
  message: string;
};

export type VersionedDocumentStore = {
  // This is not an ideal model but we want to be able to tell that the document store we are searching in is the desired one.
  // Without this we are risking registering interest in documents from other repositories (and therefore polluting our stores).
  // TODO: Remove this when we have a good solution with data integrity when switching automerge repos.
  projectId: string | null;
  setProjectId: (id: string) => Effect.Effect<void, never, never>;
  createDocument: (
    args: CreateDocumentArgs
  ) => Effect.Effect<VersionControlId, RepositoryError, never>;
  getDocumentAtCommit: (
    args: GetDocumentAtCommitArgs
  ) => Effect.Effect<
    VersionedDocument,
    RepositoryError | NotFoundError | MigrationError,
    never
  >;
  findDocumentById: (
    id: VersionControlId
  ) => Effect.Effect<
    VersionedDocument,
    RepositoryError | NotFoundError | MigrationError,
    never
  >;
  getRichTextDocumentContent: (
    document: VersionedDocument
  ) => Effect.Effect<string, RepositoryError | NotFoundError, never>;
  updateRichTextDocumentContent: (
    args: UpdateRichTextDocumentContentArgs
  ) => Effect.Effect<
    void,
    RepositoryError | NotFoundError | MigrationError,
    never
  >;
  deleteDocument: (
    args: VersionControlId
  ) => Effect.Effect<
    void,
    MigrationError | RepositoryError | NotFoundError,
    never
  >;
  getDocumentHeads: (
    documentId: VersionControlId
  ) => Effect.Effect<
    Commit['heads'],
    RepositoryError | NotFoundError | MigrationError,
    never
  >;
  getDocumentHistory: (
    documentId: VersionControlId
  ) => Effect.Effect<
    GetDocumentHistoryResponse,
    RepositoryError | NotFoundError | MigrationError,
    never
  >;
  isContentSameAtHeads: (
    args: IsContentSameAtHeadsArgs
  ) => Effect.Effect<
    boolean,
    RepositoryError | NotFoundError | MigrationError,
    never
  >;
  commitChanges: (
    args: CommitChangesArgs
  ) => Effect.Effect<
    void,
    RepositoryError | NotFoundError | MigrationError,
    never
  >;
  exportDocumentToBinary: (
    document: VersionedDocument
  ) => Effect.Effect<Uint8Array, RepositoryError, never>;
  importDocumentFromBinary: (
    data: Uint8Array
  ) => Effect.Effect<VersionedDocument, RepositoryError, never>;
  disconnect: () => Effect.Effect<void, RepositoryError, never>;
  // TODO: Extract to a `RealtimeVersionedDocumentStore`
  getDocumentHandleAtCommit: (
    args: GetDocumentHandleAtCommitArgs
  ) => Effect.Effect<VersionedDocumentHandle, RepositoryError, never>;
  findDocumentHandleById: (
    id: VersionControlId
  ) => Effect.Effect<
    VersionedDocumentHandle,
    MigrationError | RepositoryError | NotFoundError,
    never
  >;
  getDocumentFromHandle: (
    handle: VersionedDocumentHandle
  ) => Effect.Effect<
    VersionedDocument,
    RepositoryError | NotFoundError | MigrationError,
    never
  >;
  getDocumentHandleHistory: (
    handle: VersionedDocumentHandle
  ) => Effect.Effect<GetDocumentHandleHistoryResponse, RepositoryError, never>;
  exportDocumentHandleToBinary: (
    documentHandle: VersionedDocumentHandle
  ) => Effect.Effect<
    Uint8Array,
    RepositoryError | NotFoundError | MigrationError,
    never
  >;
};
