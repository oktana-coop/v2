import type {
  DocumentMetaData,
  Project,
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
  findDocumentById: (
    id: VersionControlId
  ) => Promise<VersionedDocumentHandle | null>;
};
