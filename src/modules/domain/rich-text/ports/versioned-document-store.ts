import * as Effect from 'effect/Effect';

import {
  type Branch,
  type Change,
  type Commit,
  type MigrationError,
  type ResolvedArtifactId,
} from '../../../../modules/infrastructure/version-control';
import {
  DeletedDocumentError,
  NotFoundError,
  RepositoryError,
  ValidationError,
} from '../errors';
import {
  type ResolvedDocument,
  RichTextRepresentation,
  type VersionedDocument,
} from '../models';

export type CreateDocumentArgs = {
  content: string | null;
  filePath?: string;
  writeToFile?: boolean;
  branch?: Branch;
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
  hasUncommittedChanges: boolean;
};

export type IsContentSameAtChangesArgs = {
  documentId: ResolvedArtifactId;
  change1: Change['id'];
  change2: Change['id'];
};

export type DiscardUncommittedChangesArgs = {
  documentId: ResolvedArtifactId;
  writeToFileWithPath?: string;
};

export type DeleteDocumentArgs = {
  documentId: ResolvedArtifactId;
  deleteFromFilesystem?: boolean;
};

export type ResolveContentConflictArgs = {
  documentId: ResolvedArtifactId;
};

export type VersionedDocumentStore = {
  // This is not an ideal model but we want to be able to tell that the document store we are searching in is the desired one.
  // Without this we are risking reading documents from other repositories (and therefore polluting our stores).
  // TODO: Remove this when we have a good solution with data integrity when switching project stores.
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
    args: DeleteDocumentArgs
  ) => Effect.Effect<
    void,
    ValidationError | MigrationError | RepositoryError | NotFoundError,
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
    | ValidationError
    | RepositoryError
    | NotFoundError
    | MigrationError
    | DeletedDocumentError,
    never
  >;
  isContentSameAtChanges: (
    args: IsContentSameAtChangesArgs
  ) => Effect.Effect<
    boolean,
    ValidationError | RepositoryError | NotFoundError | MigrationError,
    never
  >;
  discardUncommittedChanges: (
    args: DiscardUncommittedChangesArgs
  ) => Effect.Effect<
    void,
    ValidationError | RepositoryError | NotFoundError | MigrationError,
    never
  >;
  resolveContentConflict: (
    args: ResolveContentConflictArgs
  ) => Effect.Effect<void, ValidationError | RepositoryError, never>;
  disconnect: () => Effect.Effect<void, RepositoryError, never>;
};
