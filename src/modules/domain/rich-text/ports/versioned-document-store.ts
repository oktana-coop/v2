import * as Effect from 'effect/Effect';

import {
  type Change,
  type Commit,
  type MigrationError,
  type ResolvedArtifactId,
} from '../../../../modules/infrastructure/version-control';
import { RichTextRepresentation } from '../constants';
import { NotFoundError, RepositoryError, ValidationError } from '../errors';
import {
  type ResolvedDocument,
  type VersionedDocument,
  type VersionedDocumentHandle,
} from '../models';

export type CreateDocumentArgs = {
  content: string | null;
  id?: ResolvedArtifactId;
};

export type GetDocumentHandleAtCommitArgs = {
  documentHandle: VersionedDocumentHandle;
  heads: Commit['heads'];
};

export type GetDocumentAtCommitArgs = {
  documentId: ResolvedArtifactId;
  heads: Commit['heads'];
};

export type UpdateRichTextDocumentContentArgs = {
  documentId: ResolvedArtifactId;
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
  documentId: ResolvedArtifactId;
  heads1: Commit['heads'];
  heads2: Commit['heads'];
};

export type CommitChangesArgs = {
  documentId: ResolvedArtifactId;
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
  ) => Effect.Effect<
    ResolvedArtifactId,
    ValidationError | RepositoryError,
    never
  >;
  getDocumentAtCommit: (
    args: GetDocumentAtCommitArgs
  ) => Effect.Effect<
    VersionedDocument,
    ValidationError | RepositoryError | NotFoundError | MigrationError,
    never
  >;
  findDocumentById: (
    id: ResolvedArtifactId
  ) => Effect.Effect<
    ResolvedDocument,
    ValidationError | RepositoryError | NotFoundError | MigrationError,
    never
  >;
  updateRichTextDocumentContent: (
    args: UpdateRichTextDocumentContentArgs
  ) => Effect.Effect<
    void,
    ValidationError | RepositoryError | NotFoundError | MigrationError,
    never
  >;
  deleteDocument: (
    args: ResolvedArtifactId
  ) => Effect.Effect<
    void,
    ValidationError | MigrationError | RepositoryError | NotFoundError,
    never
  >;
  getDocumentHeads: (
    documentId: ResolvedArtifactId
  ) => Effect.Effect<
    Commit['heads'],
    ValidationError | RepositoryError | NotFoundError | MigrationError,
    never
  >;
  getDocumentHistory: (
    documentId: ResolvedArtifactId
  ) => Effect.Effect<
    GetDocumentHistoryResponse,
    ValidationError | RepositoryError | NotFoundError | MigrationError,
    never
  >;
  isContentSameAtHeads: (
    args: IsContentSameAtHeadsArgs
  ) => Effect.Effect<
    boolean,
    ValidationError | RepositoryError | NotFoundError | MigrationError,
    never
  >;
  commitChanges: (
    args: CommitChangesArgs
  ) => Effect.Effect<
    void,
    ValidationError | RepositoryError | NotFoundError | MigrationError,
    never
  >;
  exportDocumentToBinary: (
    document: VersionedDocument
  ) => Effect.Effect<Uint8Array, RepositoryError, never>;
  importDocumentFromBinary: (
    data: Uint8Array
  ) => Effect.Effect<VersionedDocument, RepositoryError, never>;
  disconnect: () => Effect.Effect<void, RepositoryError, never>;
};

export type RealtimeVersionedDocumentStore = VersionedDocumentStore & {
  getDocumentHandleAtCommit: (
    args: GetDocumentHandleAtCommitArgs
  ) => Effect.Effect<VersionedDocumentHandle, RepositoryError, never>;
  findDocumentHandleById: (
    id: ResolvedArtifactId
  ) => Effect.Effect<
    VersionedDocumentHandle,
    ValidationError | MigrationError | RepositoryError | NotFoundError,
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
