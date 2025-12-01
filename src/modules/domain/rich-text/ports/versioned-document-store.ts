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
  filePath?: string;
  writeToFile?: boolean;
};

export type GetDocumentHandleAtChangeArgs = {
  documentHandle: VersionedDocumentHandle;
  changeId: Change['id'];
};

export type GetDocumentAtChangeArgs = {
  documentId: ResolvedArtifactId;
  changeId: Change['id'];
};

export type UpdateRichTextDocumentContentArgs = {
  documentId: ResolvedArtifactId;
  representation: RichTextRepresentation;
  content: string;
  writeToFileWithPath?: string;
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

export type IsContentSameAtChangesArgs = {
  documentId: ResolvedArtifactId;
  change1: Change['id'];
  change2: Change['id'];
};

export type CommitChangesArgs = {
  documentId: ResolvedArtifactId;
  message: string;
};

export type RestoreCommitArgs = {
  documentId: ResolvedArtifactId;
  commit: Commit;
  message?: string;
};

export type VersionedDocumentStore = {
  // This is not an ideal model but we want to be able to tell that the document store we are searching in is the desired one.
  // Without this we are risking registering interest in documents from other repositories (and therefore polluting our stores).
  // TODO: Remove this when we have a good solution with data integrity when switching automerge repos.
  projectId: string | null;
  setProjectId: (id: string) => Effect.Effect<void, never, never>;
  managesFilesystemWorkdir: boolean;
  createDocument: (
    args: CreateDocumentArgs
  ) => Effect.Effect<
    ResolvedArtifactId,
    ValidationError | RepositoryError,
    never
  >;
  findDocumentById: (
    id: ResolvedArtifactId
  ) => Effect.Effect<
    ResolvedDocument,
    ValidationError | RepositoryError | NotFoundError | MigrationError,
    never
  >;
  getDocumentLastChangeId: (
    documentId: ResolvedArtifactId
  ) => Effect.Effect<
    Change['id'],
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
    id: ResolvedArtifactId
  ) => Effect.Effect<
    void,
    ValidationError | MigrationError | RepositoryError | NotFoundError,
    never
  >;
  commitChanges: (
    args: CommitChangesArgs
  ) => Effect.Effect<
    void,
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
  getDocumentAtChange: (
    args: GetDocumentAtChangeArgs
  ) => Effect.Effect<
    VersionedDocument,
    ValidationError | RepositoryError | NotFoundError | MigrationError,
    never
  >;
  isContentSameAtChanges: (
    args: IsContentSameAtChangesArgs
  ) => Effect.Effect<
    boolean,
    ValidationError | RepositoryError | NotFoundError | MigrationError,
    never
  >;
  restoreCommit: (
    args: RestoreCommitArgs
  ) => Effect.Effect<
    Commit['id'],
    ValidationError | RepositoryError | NotFoundError | MigrationError,
    never
  >;
  exportDocumentToBinary?: (
    document: VersionedDocument
  ) => Effect.Effect<Uint8Array, RepositoryError, never>;
  importDocumentFromBinary?: (
    data: Uint8Array
  ) => Effect.Effect<VersionedDocument, RepositoryError, never>;
  disconnect: () => Effect.Effect<void, RepositoryError, never>;
};

export type RealtimeVersionedDocumentStore = VersionedDocumentStore & {
  getDocumentHandleAtChange: (
    args: GetDocumentHandleAtChangeArgs
  ) => Effect.Effect<
    VersionedDocumentHandle,
    ValidationError | RepositoryError,
    never
  >;
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
