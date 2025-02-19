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

export type GetWriteableHandleAtCommitArgs = {
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
  createProject: (args: CreateProjectArgs) => Promise<VersionControlId>;
  findProjectById: (
    id: VersionControlId
  ) => Promise<VersionedProjectHandle | null>;
  listProjectDocuments: (
    id: VersionControlId
  ) => Promise<Array<DocumentMetaData>>;
  createDocument: ({
    title,
    name,
    path,
    projectId,
  }: CreateDocumentArgs) => Promise<VersionControlId>;
  getDocumentHandleAtCommit: ({
    documentHandle,
    heads,
  }: GetDocumentHandleAtCommitArgs) => VersionedDocumentHandle;
  findDocumentById: (
    id: VersionControlId
  ) => Promise<VersionedDocumentHandle | null>;
  deleteDocumentFromProject: (
    args: DeleteDocumentFromProjectArgs
  ) => Promise<void>;
  findDocumentInProject: (
    args: FindDocumentInProjectArgs
  ) => Promise<VersionedDocumentHandle | null>;
  // TODO: Think of a better abstraction - this is too Automerge-specific
  updateDocumentSpans: (args: UpdateDocumentSpansArgs) => Promise<void>;
};
