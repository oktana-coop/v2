import * as Effect from 'effect/Effect';

import { NotFoundError, RepositoryError } from '../errors';
import type {
  Commit,
  DocumentMetaData,
  Project,
  RichTextDocumentSpan,
  VersionControlId,
  VersionedDocumentHandle,
  VersionedProjectHandle,
} from '../models';

export type CreateProjectArgs = {
  path: string;
  documents: Project['documents'];
};

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

export type DeleteDocumentFromProjectArgs = {
  projectId: VersionControlId;
  documentId: VersionControlId;
};

export type FindDocumentInProjectArgs = {
  projectId: VersionControlId;
  documentPath: string;
};

export type UpdateDocumentSpansArgs = {
  documentHandle: VersionedDocumentHandle;
  spans: Array<RichTextDocumentSpan>;
};

export type VersionControlRepo = {
  createProject: (
    args: CreateProjectArgs
  ) => Effect.Effect<VersionControlId, RepositoryError | NotFoundError, never>;
  findProjectById: (
    id: VersionControlId
  ) => Effect.Effect<
    VersionedProjectHandle,
    RepositoryError | NotFoundError,
    never
  >;
  listProjectDocuments: (
    id: VersionControlId
  ) => Effect.Effect<DocumentMetaData[], RepositoryError, never>;
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
  deleteDocumentFromProject: (
    args: DeleteDocumentFromProjectArgs
  ) => Effect.Effect<void, RepositoryError | NotFoundError, never>;
  findDocumentInProject: (
    args: FindDocumentInProjectArgs
  ) => Effect.Effect<
    VersionedDocumentHandle,
    RepositoryError | NotFoundError,
    never
  >;
  // TODO: Think of a better abstraction - this is too Automerge-specific
  updateDocumentSpans: (
    args: UpdateDocumentSpansArgs
  ) => Effect.Effect<void, RepositoryError | NotFoundError, never>;
};
