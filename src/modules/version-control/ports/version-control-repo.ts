import type {
  VersionControlId,
  VersionedDocumentHandle,
  VersionedProjectHandle,
} from '../models';

export type CreateProjectArgs = {
  path: string;
};

export type CreateDocumentArgs = {
  title: string;
  path: string;
  projectId: VersionControlId | null;
};

export type VersionControlRepo = {
  createProject: (args: CreateProjectArgs) => Promise<VersionControlId>;
  findProjectById: (
    id: VersionControlId
  ) => Promise<VersionedProjectHandle | null>;
  createDocument: ({
    title,
    path,
    projectId,
  }: CreateDocumentArgs) => Promise<VersionControlId>;
  findDocumentById: (
    id: VersionControlId
  ) => Promise<VersionedDocumentHandle | null>;
};
